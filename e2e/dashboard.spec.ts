import { expect, test } from "@playwright/test";

import { clearTestDailyLogItemsByTitle } from "./support/daily-logs-db";
import { clearEventsWithPrefix, insertTestEvent } from "./support/events-db";
import { clearTestIdeas, seedTestIdea } from "./support/ideas-db";

const PREFIX = "[e2e-dashboard]";
const WORK_EVENT_TITLE = `${PREFIX} Standup`;
const STUCK_IDEA_TITLE = `${PREFIX} Stuck idea`;
const SCRIPTED_IDEA_TITLE = `${PREFIX} Scripted idea`;
const LOG_ITEM_TITLE = `${PREFIX} Ship the dashboard`;

const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping dashboard DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const AGENDA_ITEM_SELECTOR = '[data-slot="agenda-item"]';

// Mirrors agenda.spec.ts: one file, serialized, own seed prefix so this
// suite's rows can't race another spec's concurrently-running fixtures
// against the same dev database.
test.describe.configure({ mode: "serial" });

test.describe("dashboard", () => {
  test.skip(skip, skipReason);

  test.beforeAll(async () => {
    const now = new Date();
    await insertTestEvent({
      title: WORK_EVENT_TITLE,
      track: "work",
      startsAt: new Date(now.getTime() + 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 1.5 * 60 * 60 * 1000),
    });
    // Backdated so it's deterministically the "stuck longest" pick
    // regardless of whatever else exists in the dev database.
    await seedTestIdea({
      title: STUCK_IDEA_TITLE,
      status: "idea",
      stageEnteredAt: new Date("2000-01-01"),
    });
    await seedTestIdea({ title: SCRIPTED_IDEA_TITLE, status: "scripted" });
  });

  test.afterAll(async () => {
    await clearEventsWithPrefix(PREFIX);
    await clearTestIdeas(PREFIX);
    await clearTestDailyLogItemsByTitle(PREFIX);
  });

  test("shows today's seeded event in the agenda block, deep-linking to the calendar", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeVisible();
    await expect(
      page.locator(AGENDA_ITEM_SELECTOR, { hasText: WORK_EVENT_TITLE })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View calendar →" })
    ).toHaveAttribute("href", "/calendar?view=day");
  });

  test("shows per-stage counts and the stuck-longest idea in the content block, deep-linking to the board", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Content in flight")).toBeVisible();
    await expect(page.getByText(/Idea/)).toBeVisible();
    await expect(page.getByText(STUCK_IDEA_TITLE)).toBeVisible();

    await page.getByRole("link", { name: "Open board →" }).click();
    await expect(page).toHaveURL("/content/board");
  });

  test("today's log CTA reflects an added item and deep-links into the journal and standup", async ({
    page,
  }) => {
    // Written against the real "today" (like the journal mobile-viewport
    // check in mobile.spec.ts) since the dashboard only ever shows today's
    // log — cleanup only removes this prefix's item, never the day's
    // retro/mood or any other real item.
    await page.goto("/journal");
    await page.getByLabel("Add planned item").fill(LOG_ITEM_TITLE);
    await page.keyboard.press("Enter");
    await expect(page.getByText(LOG_ITEM_TITLE)).toBeVisible();

    await page.goto("/");
    await expect(page.getByText("Today's log")).toBeVisible();
    const continueLink = page.getByRole("button", {
      name: "Continue today's log",
    });
    await expect(continueLink).toBeVisible();
    await expect(page.getByText(/planned/)).toBeVisible();

    await continueLink.click();
    await expect(page).toHaveURL(/\/journal$/);

    await page.goto("/");
    await page.getByRole("link", { name: "Standup" }).click();
    await expect(page).toHaveURL("/journal/standup");
  });
});

test.describe("dashboard mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  test("date header and today's log block are visible above the fold, no horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeInViewport();
    await expect(page.getByText("Today's log")).toBeInViewport();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
