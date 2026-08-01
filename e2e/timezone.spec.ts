import { expect, test } from "@playwright/test";

import { formatDateParam } from "../lib/calendar/range";
import { parseAppDateTime } from "../lib/time";
import { clearEventsWithPrefix, getTestEventTimes } from "./support/events-db";
import { clearTestIdeas } from "./support/ideas-db";

/**
 * The regression guard for issue #95: a time saved as 19:00 must still read
 * 19:00 after a reload.
 *
 * What makes this meaningful is the configuration in playwright.config.ts —
 * the Next server runs with `TZ=UTC` (like Vercel) while the browser and the
 * runner are in `Europe/Madrid`. Under the old renderer-local parsing this
 * spec fails by exactly the Madrid offset: +2h in summer, +1h in winter. Run
 * against a server in the same zone as the browser, it would pass either way —
 * which is precisely why the bug reached production.
 */
const PREFIX = "[e2e-tz]";

const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping timezone DB-backed checks. " +
  "Set it locally (see .env.example) or on a Vercel preview to exercise this.";

/** Matches date-fns's `format(date, "MMMM d, yyyy")`, used in the app's aria-labels. */
function longDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Far enough out that neither `pnpm seed:events` nor the other specs'
// today-anchored fixtures can sit on top of the slot being tapped, matching
// event-management.spec.ts's convention.
const target = new Date();
target.setHours(0, 0, 0, 0);
target.setDate(target.getDate() + 75);
const targetParam = formatDateParam(target);
const targetLongLabel = longDateLabel(target);

test.describe("timezone: saved times survive a reload", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await clearEventsWithPrefix(PREFIX);
    // Also sweeps the managed `Release: <title>` event an idea owns (#71).
    await clearTestIdeas(PREFIX);
  });

  test("a 19:00 event still reads 19:00 after saving and reloading", async ({
    page,
  }) => {
    const title = `${PREFIX} Evening stream`;
    await page.goto(`/calendar?view=week&date=${targetParam}`);

    await page
      .getByRole("button", { name: `Add event at 19:00 on ${targetLongLabel}` })
      .click();

    const dialog = page.getByRole("dialog", { name: "New event" });
    await expect(dialog).toBeVisible();
    // The slot tap must prefill the hour that was tapped, not the server's
    // reading of it.
    await expect(dialog.getByLabel("Start time")).toHaveValue("19:00");
    await dialog.getByRole("radio", { name: /content/i }).click();
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Full reload: everything below is re-rendered by the UTC server and
    // re-hydrated by the Madrid browser.
    await page.reload();

    const block = page.locator('[data-slot="event-block"]', {
      hasText: title,
    });
    await expect(block).toBeVisible();
    await expect(block).toContainText("19:00–20:00");

    // Reopening the editor must round-trip the same wall clock back into the
    // form, not the stored instant read in the wrong zone.
    await block.click();
    const editor = page.getByRole("dialog", { name: "Edit event" });
    await expect(editor.getByLabel("Start time")).toHaveValue("19:00");
    await expect(editor.getByLabel("End time")).toHaveValue("20:00");
    await editor.getByRole("button", { name: "Save" }).click();
    await expect(editor).not.toBeVisible({ timeout: 10000 });

    // And the row itself is the absolute instant 19:00 Madrid denotes — the
    // assertion the UI-level ones ultimately rest on.
    const stored = await getTestEventTimes(title);
    expect(stored?.startsAt.toISOString()).toBe(
      parseAppDateTime(targetParam, "19:00")!.toISOString()
    );
  });

  test("editing the time to 19:00 saves 19:00, not the server's reading of it", async ({
    page,
  }) => {
    const title = `${PREFIX} Rescheduled recording`;
    await page.goto(`/calendar?view=week&date=${targetParam}`);

    await page
      .getByRole("button", { name: `Add event at 9:00 on ${targetLongLabel}` })
      .click();
    let dialog = page.getByRole("dialog", { name: "New event" });
    await dialog.getByRole("radio", { name: /work/i }).click();
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page.locator('[data-slot="event-block"]', { hasText: title }).click();
    dialog = page.getByRole("dialog", { name: "Edit event" });
    await dialog.getByLabel("Start time").fill("19:00");
    await dialog.getByLabel("End time").fill("20:30");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page.reload();
    await expect(
      page.locator('[data-slot="event-block"]', { hasText: title })
    ).toContainText("19:00–20:30");

    const stored = await getTestEventTimes(title);
    expect(stored?.startsAt.toISOString()).toBe(
      parseAppDateTime(targetParam, "19:00")!.toISOString()
    );
    expect(stored?.endsAt.toISOString()).toBe(
      parseAppDateTime(targetParam, "20:30")!.toISOString()
    );
  });

  test("an all-day event stays on its own day and doesn't bleed into neighbours", async ({
    page,
  }) => {
    const title = `${PREFIX} All-day planning`;
    await page.goto(`/calendar?view=month&date=${targetParam}`);

    await page
      .getByRole("button", { name: `Add event on ${targetLongLabel}` })
      .click();
    const dialog = page.getByRole("dialog", { name: "New event" });
    await expect(dialog.getByRole("switch", { name: "All day" })).toBeChecked();
    await dialog.getByRole("radio", { name: /work/i }).click();
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page.reload();

    // Exactly one cell carries the chip: an all-day boundary computed in the
    // wrong zone lands two hours into the neighbouring day and renders twice.
    await expect(
      page.locator('[data-slot="event-chip"]', { hasText: title })
    ).toHaveCount(1);

    // The day view for that date shows it; the day before does not.
    await page.goto(`/calendar?view=day&date=${targetParam}`);
    await expect(
      page.locator('[data-slot="event-chip"]', { hasText: title })
    ).toBeVisible();

    const dayBefore = new Date(target);
    dayBefore.setDate(dayBefore.getDate() - 1);
    await page.goto(`/calendar?view=day&date=${formatDateParam(dayBefore)}`);
    await expect(
      page.locator('[data-slot="event-chip"]', { hasText: title })
    ).toHaveCount(0);
  });

  test("the idea release default lands at 19:00 on the calendar", async ({
    page,
  }) => {
    // The 19:00 default release time is parsed by a different schema
    // (lib/content/idea-schema.ts) than the event form — it had its own copy
    // of the same bug.
    const title = `${PREFIX} Release default idea`;
    await page.goto("/content/ideas");

    await page.getByRole("button", { name: "New idea" }).click();
    const dialog = page.getByRole("dialog", { name: "New idea" });
    await dialog.getByLabel("Title").fill(title);
    // Deliberately no release *time*: the 19:00 default is applied by the
    // schema, which is the copy of the parser being tested here.
    await dialog.getByLabel("Release date").fill(targetParam);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 30000 });

    await page.goto(`/calendar?view=day&date=${targetParam}`);
    const block = page.locator('[data-slot="event-block"]', {
      hasText: `Release: ${title}`,
    });
    await expect(block).toBeVisible();
    await expect(block).toContainText("19:00–20:00");

    const stored = await getTestEventTimes(`Release: ${title}`);
    expect(stored?.startsAt.toISOString()).toBe(
      parseAppDateTime(targetParam, "19:00")!.toISOString()
    );
  });
});
