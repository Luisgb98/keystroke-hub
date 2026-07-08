import { expect, test } from "@playwright/test";
import { addDays, startOfDay } from "date-fns";

import { clearEventsWithPrefix, insertTestEvent } from "./support/events-db";

// Own prefix (not the shared `[e2e]` one calendar.spec.ts uses) so cleanup
// here can't sweep up another spec file's concurrently-running fixtures —
// same reasoning as event-management.spec.ts (see docs/calendar.md).
const PREFIX = "[e2e-agenda]";
const WORK_TITLE = `${PREFIX} Work sync`;
const CONTENT_TITLE = `${PREFIX} Record stream`;
const TOMORROW_TITLE = `${PREFIX} All-day work offsite`;

const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping agenda DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const AGENDA_ITEM_SELECTOR = '[data-slot="agenda-item"]';

// Both describe blocks below seed/clear rows under the same `[e2e-agenda]`
// prefix. Serializing the whole file (not just each describe) keeps them in
// one worker so their seed/cleanup cycles can't race each other — same
// reasoning as calendar.spec.ts.
test.describe.configure({ mode: "serial" });

test.describe("upcoming agenda widget", () => {
  test.skip(skip, skipReason);

  test.beforeAll(async () => {
    const now = new Date();
    // Offsets from "now" (rather than fixed clock hours) guarantee these
    // land in the widget's "hasn't ended" window regardless of when the
    // suite runs; the one residual risk is a run late enough at night that
    // +2h/+3h roll past midnight, which would reclassify these as
    // "Tomorrow" instead of "Today" — acceptable for a personal-app e2e
    // suite, same tolerance calendar.spec.ts's fixed-hour fixtures accept.
    await insertTestEvent({
      title: WORK_TITLE,
      track: "work",
      startsAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 2.5 * 60 * 60 * 1000),
    });
    await insertTestEvent({
      title: CONTENT_TITLE,
      track: "content",
      startsAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 3.5 * 60 * 60 * 1000),
    });
    // All-day, so its "Tomorrow" bucket is determined purely by calendar
    // date rather than clock time — no midnight-rollover ambiguity.
    const tomorrow = addDays(startOfDay(now), 1);
    await insertTestEvent({
      title: TOMORROW_TITLE,
      track: "work",
      startsAt: tomorrow,
      endsAt: tomorrow,
      allDay: true,
    });
  });

  test.afterAll(async () => {
    await clearEventsWithPrefix(PREFIX);
  });

  test("lists today's and tomorrow's events grouped under day headers, track-distinct", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tomorrow" })).toBeVisible();

    const workItem = page.locator(AGENDA_ITEM_SELECTOR, {
      hasText: WORK_TITLE,
    });
    const contentItem = page.locator(AGENDA_ITEM_SELECTOR, {
      hasText: CONTENT_TITLE,
    });
    const tomorrowItem = page.locator(AGENDA_ITEM_SELECTOR, {
      hasText: TOMORROW_TITLE,
    });

    await expect(workItem).toBeVisible();
    await expect(contentItem).toBeVisible();
    await expect(tomorrowItem).toBeVisible();

    await expect(workItem).toHaveClass(/border-track-work-border/);
    await expect(contentItem).toHaveClass(/border-track-content-border/);
    // Color is never the only signal — each track also carries its own icon.
    await expect(workItem.locator("svg")).toBeVisible();
    await expect(contentItem.locator("svg")).toBeVisible();
  });

  test("tapping an agenda item opens the edit dialog with that event's data", async ({
    page,
  }) => {
    await page.goto("/");

    await page.locator(AGENDA_ITEM_SELECTOR, { hasText: WORK_TITLE }).click();

    const dialog = page.getByRole("dialog", { name: "Edit event" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Title")).toHaveValue(WORK_TITLE);
  });

  test("has a link back to the full calendar", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "View calendar →" })
    ).toHaveAttribute("href", "/calendar?view=day");
  });
});

test.describe("upcoming agenda widget mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  test.beforeAll(async () => {
    const now = new Date();
    await insertTestEvent({
      title: WORK_TITLE,
      track: "work",
      startsAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 2.5 * 60 * 60 * 1000),
    });
  });

  test.afterAll(async () => {
    await clearEventsWithPrefix(PREFIX);
  });

  test("home page with agenda items has no horizontal overflow on a phone", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.locator(AGENDA_ITEM_SELECTOR, { hasText: WORK_TITLE })
    ).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
