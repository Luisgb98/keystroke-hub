import { expect, test } from "@playwright/test";

import { formatDateParam } from "../lib/calendar/range";
import { clearEventsWithPrefix } from "./support/events-db";

// This file creates/edits/deletes real rows through the UI against the same
// dev database as calendar.spec.ts. It uses its own title prefix (not the
// shared `[e2e]` one) so its cleanup can't sweep up calendar.spec.ts's
// fixtures — or vice versa — if the two spec files happen to run
// concurrently in different Playwright workers (see docs/calendar.md).
const PREFIX = "[e2e-mgmt]";

const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping event-management DB-backed checks. " +
  "Set it locally (see .env.example) or on a Vercel preview to exercise this.";

/** Matches date-fns's `format(date, "MMMM d, yyyy")`, used in the app's aria-labels. */
function longDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const today = new Date();
today.setHours(0, 0, 0, 0);
const todayParam = formatDateParam(today);

// Slot/cell-tap tests target a date far outside `pnpm seed:events`'s fixture
// window (roughly -7..+10 days from whenever it was last run) and outside
// calendar.spec.ts's own today-anchored fixtures, so there's nothing else on
// the calendar to visually cover the tapped slot/cell (see docs/calendar.md).
const target = new Date(today);
target.setDate(target.getDate() + 60);
const targetParam = formatDateParam(target);
const targetLongLabel = longDateLabel(target);

// Week view renders every event twice in the DOM — once as an `EventChip` in
// the mobile agenda list, once as an `EventBlock` in the desktop time grid —
// toggling which is visible via CSS breakpoints rather than conditional
// rendering (see docs/calendar.md). Every event created/opened in this file
// is timed (not all-day), so scoping to the block specifically avoids a
// strict-mode "multiple elements" violation on click.
const EVENT_BLOCK_SELECTOR = '[data-slot="event-block"]';

test.describe("event management", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await clearEventsWithPrefix(PREFIX);
  });

  test("quick-adds a timed work event from a week-view slot", async ({
    page,
  }) => {
    const title = `${PREFIX} Slot work event`;
    await page.goto(`/calendar?view=week&date=${targetParam}`);

    await page
      .getByRole("button", { name: `Add event at 9:00 on ${targetLongLabel}` })
      .click();

    const dialog = page.getByRole("dialog", { name: "New event" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: /work/i }).click();
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    const block = page.locator(
      '[data-slot="event-block"].border-track-work-border',
      { hasText: title }
    );
    await expect(block).toBeVisible();
    await expect(
      page.locator('[data-slot="event-toast"]', { hasText: title })
    ).toContainText("Work");
  });

  test("quick-adds an all-day content event from a month-view cell's +", async ({
    page,
  }) => {
    const title = `${PREFIX} Month all-day content event`;
    await page.goto(`/calendar?view=month&date=${targetParam}`);

    await page
      .getByRole("button", { name: `Add event on ${targetLongLabel}` })
      .click();

    const dialog = page.getByRole("dialog", { name: "New event" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("switch", { name: "All day" })).toBeChecked();
    await dialog.getByRole("radio", { name: /content/i }).click();
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    const chip = page.locator(
      '[data-slot="event-chip"].border-track-content-border',
      { hasText: title }
    );
    await expect(chip).toBeVisible();
  });

  test("editing an event's title and track restyles it", async ({ page }) => {
    const originalTitle = `${PREFIX} Editable event`;
    const newTitle = `${PREFIX} Edited event`;
    await page.goto(`/calendar?view=week&date=${targetParam}`);

    await page
      .getByRole("button", {
        name: `Add event at 10:00 on ${targetLongLabel}`,
      })
      .click();
    let dialog = page.getByRole("dialog", { name: "New event" });
    await dialog.getByRole("radio", { name: /work/i }).click();
    await dialog.getByLabel("Title").fill(originalTitle);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page
      .locator(EVENT_BLOCK_SELECTOR, { hasText: originalTitle })
      .click();
    dialog = page.getByRole("dialog", { name: "Edit event" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Title").fill(newTitle);
    await dialog.getByRole("radio", { name: /content/i }).click();
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('[data-slot="event-block"].border-track-content-border', {
        hasText: newTitle,
      })
    ).toBeVisible();
    await expect(
      page.locator(EVENT_BLOCK_SELECTOR, { hasText: originalTitle })
    ).toHaveCount(0);
  });

  test("delete requires confirmation; cancel keeps the event", async ({
    page,
  }) => {
    const title = `${PREFIX} Deletable event`;
    await page.goto(`/calendar?view=week&date=${targetParam}`);

    await page
      .getByRole("button", {
        name: `Add event at 11:00 on ${targetLongLabel}`,
      })
      .click();
    let dialog = page.getByRole("dialog", { name: "New event" });
    await dialog.getByRole("radio", { name: /work/i }).click();
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page.locator(EVENT_BLOCK_SELECTOR, { hasText: title }).click();
    dialog = page.getByRole("dialog", { name: "Edit event" });
    await dialog.getByRole("button", { name: "Delete" }).click();

    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();

    // Cancel only dismisses the confirmation — the edit dialog underneath
    // stays open (and the calendar behind it stays non-interactive), so
    // re-verify from there rather than trying to re-click the covered chip.
    await expect(confirm).not.toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Title")).toHaveValue(title);

    await dialog.getByRole("button", { name: "Delete" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete" })
      .click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(
      page.locator(EVENT_BLOCK_SELECTOR, { hasText: title })
    ).toHaveCount(0);
  });
});

test.describe("event management mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  test.afterEach(async () => {
    await clearEventsWithPrefix(PREFIX);
  });

  test("quick-adds an event from the header 'New event' button", async ({
    page,
  }) => {
    const title = `${PREFIX} Mobile header event`;
    // The header button always defaults to "now" (lib/calendar/quick-add.ts's
    // quickAddFromNow), regardless of which date is being viewed — so this
    // stays on today's day view rather than the far-future `target` date
    // used by the slot/cell-tap tests above.
    await page.goto(`/calendar?view=day&date=${todayParam}`);

    await page.getByRole("button", { name: "New event" }).click();
    const dialog = page.getByRole("dialog", { name: "New event" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: /content/i }).click();
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(
      page.locator(EVENT_BLOCK_SELECTOR, { hasText: title })
    ).toBeVisible();
  });
});
