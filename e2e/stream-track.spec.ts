import { expect, test, type Page } from "@playwright/test";

import { formatDateParam } from "../lib/calendar/range";
import { clearEventsWithPrefix } from "./support/events-db";
import {
  clearTestStreams,
  clearTestTemplateItems,
  seedTemplateItems,
} from "./support/streams-db";

// Issue #104. Everything here reads or writes the real database, so — like the
// streams/ideas/board suites — it only runs where DATABASE_URL is available
// (local dev or a Vercel preview), not in CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping stream-track DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const EVENT_BLOCK = '[data-slot="event-block"]';
const STREAM_BLOCK = `${EVENT_BLOCK}.border-track-stream-border`;
const CONTENT_BLOCK = `${EVENT_BLOCK}.border-track-content-border`;
const STREAM_CARD = '[data-slot="stream-card"]';

const PREFIX = "[e2e-stream-track]";

/** Far enough out to have nothing else on the calendar, and clear of the other suites' target dates. */
const target = new Date();
target.setHours(0, 0, 0, 0);
target.setDate(target.getDate() + 120);
const targetParam = formatDateParam(target);

/** Matches date-fns's `format(date, "MMMM d, yyyy")`, used in the app's aria-labels. */
const targetLongLabel = target.toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** Quick-adds an event from a day-view hour slot, choosing `track` in the picker. */
async function quickAdd(
  page: Page,
  { title, track, hour = 9 }: { title: string; track: RegExp; hour?: number }
) {
  await page.goto(`/calendar?view=day&date=${targetParam}`);
  await page
    .getByRole("button", {
      name: `Add event at ${hour}:00 on ${targetLongLabel}`,
    })
    .click();

  const dialog = page.getByRole("dialog", { name: "New event" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: track }).click();
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10000 });
}

/** Reopens an existing block's editor by title. */
async function openEditor(page: Page, title: string) {
  await page.locator(EVENT_BLOCK, { hasText: title }).click();
  const dialog = page.getByRole("dialog", { name: "Edit event" });
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Re-navigates until the assertion holds. A single `page.goto` fetches once,
 * and Neon's HTTP driver can lag read-after-write by a few hundred ms — the
 * same precedent as `e2e/streams.spec.ts`'s delete check.
 */
async function eventually(fn: () => Promise<void>) {
  await expect(fn).toPass({ timeout: 15000 });
}

test.describe("streams are their own track on the calendar", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    // Streams first: deleting one now takes its calendar block with it, and
    // the sweep below catches anything planned without a session.
    await clearTestStreams(PREFIX);
    await clearEventsWithPrefix(PREFIX);
    await clearTestTemplateItems(PREFIX);
  });

  test("planning a Stream on the calendar creates the session behind it, checklist seeded", async ({
    page,
  }) => {
    // Seeded straight into the DB: the template is one global row set, and
    // `streams.spec.ts` drives the same dialog in a parallel worker.
    const itemLabel = `${PREFIX} Check the capture card`;
    await seedTemplateItems([itemLabel]);

    const title = `${PREFIX} Ranked ladder run`;
    await quickAdd(page, { title, track: /stream/i });

    // Purple, and never colour alone: its own icon and its own text label.
    const block = page.locator(STREAM_BLOCK, { hasText: title });
    await expect(block).toBeVisible();
    await expect(block.locator("svg")).toHaveCount(1);
    await expect(block).toContainText("Stream:");
    await expect(
      page.locator('[data-slot="event-toast"]', { hasText: title })
    ).toContainText("Stream");

    await eventually(async () => {
      await page.goto("/content/streams");
      await expect(page.locator(STREAM_CARD, { hasText: title })).toBeVisible({
        timeout: 2000,
      });
    });

    await page.locator(STREAM_CARD, { hasText: title }).click();
    await expect(page.getByText(itemLabel)).toBeVisible();
  });

  test("a stream planned on the planner is indistinguishable on the calendar", async ({
    page,
  }) => {
    const title = `${PREFIX} Planner-first stream`;
    await page.goto("/content/streams");
    await page.getByRole("button", { name: "New stream" }).click();
    const dialog = page.getByRole("dialog", { name: "New stream" });
    await dialog.getByLabel("Topic").fill(title);
    await dialog.getByRole("switch", { name: "Plan a date" }).click();
    await dialog.getByLabel("Date", { exact: true }).fill(targetParam);
    await dialog.getByLabel("Start time").fill("20:00");
    await dialog.getByRole("button", { name: "Save" }).click();
    // `StreamCreate` still closes off `useActionState`, so its close waits on
    // the `/content/streams` refresh rather than on the mutation (see
    // docs/design-system.md) — generous here, since the whole suite hammers
    // that route in parallel.
    await expect(dialog).not.toBeVisible({ timeout: 25000 });

    await eventually(async () => {
      await page.goto(`/calendar?view=day&date=${targetParam}`);
      await expect(page.locator(STREAM_BLOCK, { hasText: title })).toBeVisible({
        timeout: 2000,
      });
    });
  });

  test("a stream block leads to its session in one click", async ({ page }) => {
    const title = `${PREFIX} Jump to session`;
    await quickAdd(page, { title, track: /stream/i });

    const dialog = await openEditor(page, title);
    await dialog.getByRole("link", { name: /open stream session/i }).click();

    await expect(page).toHaveURL(/\/content\/streams\/[0-9a-f-]+$/);
    await expect(page.getByLabel("Topic")).toHaveValue(title);
  });

  test("promoting a Content block to Stream turns it purple and creates the session", async ({
    page,
  }) => {
    const title = `${PREFIX} Promote me`;
    await quickAdd(page, { title, track: /content/i });
    await expect(page.locator(CONTENT_BLOCK, { hasText: title })).toBeVisible();

    const dialog = await openEditor(page, title);
    await dialog.getByRole("radio", { name: /stream/i }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await expect(page.locator(STREAM_BLOCK, { hasText: title })).toBeVisible();

    await eventually(async () => {
      await page.goto("/content/streams");
      await expect(page.locator(STREAM_CARD, { hasText: title })).toBeVisible({
        timeout: 2000,
      });
    });
  });

  test("demoting a Stream block to Content keeps the session, unscheduled", async ({
    page,
  }) => {
    const title = `${PREFIX} Demote me`;
    await quickAdd(page, { title, track: /stream/i });

    // Something worth not losing on the way down.
    const dialog = await openEditor(page, title);
    await dialog.getByRole("link", { name: /open stream session/i }).click();
    await expect(page).toHaveURL(/\/content\/streams\//);
    const note = "Overlay needs the new alerts";
    await page.getByLabel("Prep notes").fill(note);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    await page.goto(`/calendar?view=day&date=${targetParam}`);
    const editDialog = await openEditor(page, title);
    await editDialog.getByRole("radio", { name: /content/i }).click();
    await editDialog.getByRole("button", { name: "Save" }).click();
    await expect(editDialog).not.toBeVisible({ timeout: 10000 });

    await expect(page.locator(CONTENT_BLOCK, { hasText: title })).toBeVisible();
    await expect(page.locator(STREAM_BLOCK, { hasText: title })).toHaveCount(0);

    await eventually(async () => {
      await page.goto("/content/streams");
      const card = page.locator(STREAM_CARD, { hasText: title });
      await expect(card).toBeVisible({ timeout: 2000 });
      await expect(card.getByText("Unscheduled")).toBeVisible({
        timeout: 2000,
      });
    });

    // Nothing was destroyed on the way down.
    await page.locator(STREAM_CARD, { hasText: title }).click();
    await expect(page.getByLabel("Prep notes")).toHaveValue(note);
  });

  test("flipping a Stream block to Work is refused, never a raw database error", async ({
    page,
  }) => {
    const title = `${PREFIX} Refuse me`;
    await quickAdd(page, { title, track: /stream/i });

    const dialog = await openEditor(page, title);
    await dialog.getByRole("radio", { name: /work/i }).click();
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog.getByRole("alert")).toContainText(
      "Unlink the stream first"
    );
    await expect(dialog).toBeVisible();
  });

  test("deleting the stream on the planner takes its purple block with it", async ({
    page,
  }) => {
    const title = `${PREFIX} Delete me`;
    await quickAdd(page, { title, track: /stream/i });

    await eventually(async () => {
      await page.goto("/content/streams");
      await expect(page.locator(STREAM_CARD, { hasText: title })).toBeVisible({
        timeout: 2000,
      });
    });
    await page.locator(STREAM_CARD, { hasText: title }).click();
    await page.getByRole("button", { name: `Delete "${title}"` }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete" })
      .click();

    await eventually(async () => {
      await page.goto(`/calendar?view=day&date=${targetParam}`);
      await expect(page.locator(EVENT_BLOCK, { hasText: title })).toHaveCount(
        0,
        { timeout: 2000 }
      );
    });
  });

  test("deleting a purple block still just unschedules the session", async ({
    page,
  }) => {
    const title = `${PREFIX} Unschedule me`;
    await quickAdd(page, { title, track: /stream/i });

    const dialog = await openEditor(page, title);
    await dialog.getByRole("button", { name: "Delete" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await eventually(async () => {
      await page.goto("/content/streams");
      const card = page.locator(STREAM_CARD, { hasText: title });
      await expect(card).toBeVisible({ timeout: 2000 });
      await expect(card.getByText("Unscheduled")).toBeVisible({
        timeout: 2000,
      });
    });
  });
});

// A separate prefix *and* a separate day: this describe runs concurrently with
// the one above, so sharing a prefix would race its `afterEach` cleanup (the
// streams.spec.ts precedent) and sharing a day would put its block on top of
// the 9:00 slot the other describe keeps tapping.
const MOBILE_PREFIX = "[e2e-stream-track-mobile]";

const mobileTarget = new Date(target);
mobileTarget.setDate(mobileTarget.getDate() + 3);
const mobileTargetParam = formatDateParam(mobileTarget);
const mobileTargetLongLabel = mobileTarget.toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

test.describe("stream track on a phone viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  test.afterEach(async () => {
    await clearTestStreams(MOBILE_PREFIX);
    await clearEventsWithPrefix(MOBILE_PREFIX);
  });

  test("all three tracks stay reachable and labelled in the editor", async ({
    page,
  }) => {
    const title = `${MOBILE_PREFIX} Phone stream`;
    await page.goto(`/calendar?view=day&date=${mobileTargetParam}`);
    await page
      .getByRole("button", {
        name: `Add event at 9:00 on ${mobileTargetLongLabel}`,
      })
      .click();

    const dialog = page.getByRole("dialog", { name: "New event" });
    const options = dialog.getByRole("radio");
    await expect(options).toHaveCount(3);
    for (const name of [/work/i, /content/i, /stream/i]) {
      const option = dialog.getByRole("radio", { name });
      await expect(option).toBeVisible();
      // Still a comfortable tap target at 375px wide.
      const box = await option.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await dialog.getByRole("radio", { name: /stream/i }).click();
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await expect(page.locator(STREAM_BLOCK, { hasText: title })).toBeVisible();
  });
});
