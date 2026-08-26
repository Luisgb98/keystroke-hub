import { expect, test } from "@playwright/test";

import { formatDateParam } from "../lib/calendar/range";
import { clearEventsWithPrefix } from "./support/events-db";
import { clearTestStreams } from "./support/streams-db";

// This file creates/edits/deletes real rows through the UI against the same
// dev database as calendar.spec.ts. It uses its own title prefix (not the
// shared `[e2e]` one) so its cleanup can't sweep up calendar.spec.ts's
// fixtures — or vice versa — if the two spec files happen to run
// concurrently in different Playwright workers (see docs/calendar.md).
const PREFIX = "[e2e-mgmt]";

/** #115's suite writes rows too — see the note on its `afterEach`. */
const SINGLE_DAY_PREFIX = "[e2e-mgmt-1day]";

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

// A second day in the *same month* as `target`, so the calendar popover shows
// it without paging — the ±3 pivot keeps it inside 1..28 whatever `target` is.
const moved = new Date(target);
moved.setDate(
  target.getDate() >= 15 ? target.getDate() - 3 : target.getDate() + 3
);
const movedParam = formatDateParam(moved);

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

  test("editing start/end through the date and time pickers moves the event", async ({
    page,
  }) => {
    const title = `${PREFIX} Repickable event`;
    await page.goto(`/calendar?view=week&date=${targetParam}`);

    await page
      .getByRole("button", {
        name: `Add event at 13:00 on ${targetLongLabel}`,
      })
      .click();
    let dialog = page.getByRole("dialog", { name: "New event" });
    await dialog.getByRole("radio", { name: /work/i }).click();
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page.locator(EVENT_BLOCK_SELECTOR, { hasText: title }).click();
    dialog = page.getByRole("dialog", { name: "Edit event" });
    await expect(dialog.getByLabel("Start", { exact: true })).toHaveValue(
      targetParam
    );

    // Move the day from the calendar popover. `td[data-day]` carries the plain
    // `yyyy-MM-dd` react-day-picker renders, so this doesn't depend on the
    // locale-formatted aria-label.
    await dialog
      .getByRole("button", { name: "Open starting day calendar" })
      .click();
    await page.locator(`td[data-day="${movedParam}"] button`).click();
    // The day tapped, not the one before it — a UTC round trip would drift.
    await expect(dialog.getByLabel("Start", { exact: true })).toHaveValue(
      movedParam
    );

    await dialog.getByRole("button", { name: "Choose starting time" }).click();
    await page.getByRole("option", { name: "16:00" }).click();

    await dialog
      .getByRole("button", { name: "Open ending day calendar" })
      .click();
    await page.locator(`td[data-day="${movedParam}"] button`).click();
    await dialog.getByRole("button", { name: "Choose ending time" }).click();
    await page.getByRole("option", { name: "17:00" }).click();

    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Reopen from the moved day: the stored event round-trips to exactly the
    // values that were picked.
    await page.goto(`/calendar?view=week&date=${movedParam}`);
    await page.locator(EVENT_BLOCK_SELECTOR, { hasText: title }).click();
    dialog = page.getByRole("dialog", { name: "Edit event" });
    await expect(dialog.getByLabel("Start", { exact: true })).toHaveValue(
      movedParam
    );
    await expect(dialog.getByLabel("Start time")).toHaveValue("16:00");
    await expect(dialog.getByLabel("End", { exact: true })).toHaveValue(
      movedParam
    );
    await expect(dialog.getByLabel("End time")).toHaveValue("17:00");
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

  test("the date picker popover fits the screen with tappable days", async ({
    page,
  }) => {
    await page.goto(`/calendar?view=day&date=${todayParam}`);

    await page.getByRole("button", { name: "New event" }).click();
    const dialog = page.getByRole("dialog", { name: "New event" });
    await dialog
      .getByRole("button", { name: "Open starting day calendar" })
      .click();

    const popover = page.locator('[data-slot="popover-content"]');
    await expect(popover).toBeVisible();

    const box = await popover.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    // Days are a comfortable tap target on touch, not the compact desktop cell.
    const dayBox = await page
      .locator("td[data-day] button")
      .first()
      .boundingBox();
    expect(dayBox!.height).toBeGreaterThanOrEqual(32);
    expect(dayBox!.width).toBeGreaterThanOrEqual(32);
  });
});

/**
 * Content-track events are single-day (#115): a stream or a release begins and
 * ends on the same day, so the editor asks for one date and work keeps the
 * full range.
 */
test.describe("single-day content events", () => {
  test.skip(skip, skipReason);

  /**
   * Cleanup is scoped to the exact titles the running test created, not to the
   * suite's prefix.
   *
   * `clearEventsWithPrefix` deletes by `LIKE 'prefix%'`, and `fullyParallel`
   * runs these tests in separate workers against one database — so a
   * prefix-wide `afterEach` on the three read-only tests here (which create
   * nothing and finish in a second) deleted the two writing tests' rows
   * between their save and their assertion. Playwright gives each worker its
   * own module instance, so this array only ever holds the current test's own
   * titles. Same failure the inbox mobile suite hit in #114.
   */
  const created: string[] = [];

  test.afterEach(async () => {
    for (const title of created) {
      // Streams first: creating a Stream block from the editor creates a
      // session behind it, and deleting the event alone would leave the stream
      // orphaned as "unscheduled" (same order as stream-track.spec.ts).
      await clearTestStreams(title);
      await clearEventsWithPrefix(title);
    }
    created.length = 0;
  });

  /**
   * Re-navigates until the calendar has caught up. The dialog closes on the
   * server's response while the view waits on `revalidatePath`'s refresh, and
   * a client-side nav can still be served from the router cache — so a single
   * reload is not enough under a parallel run (same helper shape as
   * stream-track.spec.ts).
   */
  async function eventually(fn: () => Promise<void>) {
    await expect(fn).toPass({ timeout: 20000 });
  }

  test("shows one Date field for a stream, and no end-date input anywhere", async ({
    page,
  }) => {
    await page.goto(`/calendar?view=day&date=${targetParam}`);
    await page.getByRole("button", { name: "New event" }).click();
    const dialog = page.getByRole("dialog", { name: "New event" });

    // Work first: the full range is still there.
    await dialog.getByRole("radio", { name: /work/i }).click();
    await expect(dialog.getByLabel("Start", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("End", { exact: true })).toBeVisible();

    // Then Stream: one date, two times, and the end-date picker is gone.
    await dialog.getByRole("radio", { name: /stream/i }).click();
    await expect(dialog.getByLabel("Date", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Start", { exact: true })).toHaveCount(0);
    await expect(dialog.getByLabel("End", { exact: true })).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Open ending day calendar" })
    ).toHaveCount(0);
    await expect(dialog.getByText("From", { exact: true })).toBeVisible();
    await expect(dialog.getByText("To", { exact: true })).toBeVisible();
  });

  test("saves a stream onto exactly one day", async ({ page }) => {
    const title = `${SINGLE_DAY_PREFIX} Single-day stream`;
    created.push(title);
    await page.goto(`/calendar?view=day&date=${targetParam}`);

    await page.getByRole("button", { name: "New event" }).click();
    const dialog = page.getByRole("dialog", { name: "New event" });
    await dialog.getByRole("radio", { name: /stream/i }).click();
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByLabel("Date", { exact: true }).fill(targetParam);
    await dialog.getByLabel("Start time").fill("20:00");
    await dialog.getByLabel("End time").fill("22:00");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await eventually(async () => {
      await page.goto(`/calendar?view=day&date=${targetParam}`);
      await expect(
        page.locator(EVENT_BLOCK_SELECTOR, { hasText: title })
      ).toBeVisible({ timeout: 2000 });
    });

    // …and not bleeding into the next day, which is what a multi-day span
    // would do.
    const next = new Date(target);
    next.setDate(target.getDate() + 1);
    await page.goto(`/calendar?view=day&date=${formatDateParam(next)}`);
    await expect(
      page.locator(EVENT_BLOCK_SELECTOR, { hasText: title })
    ).toHaveCount(0);
  });

  test("refuses an end time that isn't after the start, in plain words", async ({
    page,
  }) => {
    await page.goto(`/calendar?view=day&date=${targetParam}`);

    await page.getByRole("button", { name: "New event" }).click();
    const dialog = page.getByRole("dialog", { name: "New event" });
    await dialog.getByRole("radio", { name: /content/i }).click();
    await dialog.getByLabel("Title").fill(`${SINGLE_DAY_PREFIX} Backwards`);
    await dialog.getByLabel("Date", { exact: true }).fill(targetParam);
    await dialog.getByLabel("Start time").fill("20:00");
    await dialog.getByLabel("End time").fill("19:00");
    await dialog.getByRole("button", { name: "Save" }).click();

    // The field error names the rule; the form-level "Check the highlighted
    // fields." alert sits beside it, hence the specific match.
    await expect(
      dialog.getByRole("alert").filter({ hasText: "same day" })
    ).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("repairs the 23:00 slot default instead of opening on an invalid form", async ({
    page,
  }) => {
    // Quick-add is track-agnostic, so the last slot of the day hands the
    // dialog a 23:00 → next-day-00:00 default — real for work, impossible for
    // a stream. Choosing Stream must fix it, not complain about it.
    await page.goto(`/calendar?view=day&date=${targetParam}`);
    await page
      .getByRole("button", { name: `Add event at 23:00 on ${targetLongLabel}` })
      .click();

    const dialog = page.getByRole("dialog", { name: "New event" });
    await expect(dialog.getByLabel("End time")).toHaveValue("00:00");

    await dialog.getByRole("radio", { name: /stream/i }).click();
    await expect(dialog.getByLabel("Start time")).toHaveValue("23:00");
    await expect(dialog.getByLabel("End time")).toHaveValue("23:59");
  });

  test("keeps the full range editable on a work event", async ({ page }) => {
    const title = `${SINGLE_DAY_PREFIX} Multi-day trip`;
    created.push(title);
    await page.goto(`/calendar?view=day&date=${targetParam}`);

    await page.getByRole("button", { name: "New event" }).click();
    const dialog = page.getByRole("dialog", { name: "New event" });
    await dialog.getByRole("radio", { name: /work/i }).click();
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByLabel("Start", { exact: true }).fill(targetParam);
    await dialog.getByLabel("Start time").fill("09:00");
    const end = new Date(target);
    end.setDate(target.getDate() + 2);
    await dialog.getByLabel("End", { exact: true }).fill(formatDateParam(end));
    await dialog.getByLabel("End time").fill("17:00");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Reopened from the start day: the two dates round-trip independently,
    // which is the whole point of leaving work alone. Asserting on the stored
    // form values rather than on how a multi-day block paints keeps this about
    // the rule and not about the day view's rendering.
    await eventually(async () => {
      await page.goto(`/calendar?view=day&date=${targetParam}`);
      await expect(
        page.locator(EVENT_BLOCK_SELECTOR, { hasText: title })
      ).toBeVisible({ timeout: 2000 });
    });

    await page.locator(EVENT_BLOCK_SELECTOR, { hasText: title }).click();
    const editor = page.getByRole("dialog", { name: "Edit event" });
    await expect(editor.getByLabel("Start", { exact: true })).toHaveValue(
      targetParam
    );
    await expect(editor.getByLabel("End", { exact: true })).toHaveValue(
      formatDateParam(end)
    );
  });
});
