import { expect, test } from "@playwright/test";

import { formatDateParam } from "../lib/calendar/range";
import { clearEventsWithPrefix } from "./support/events-db";
import { clearTestStreams, clearTestTemplateItems } from "./support/streams-db";

// The streams pages query the database on every render, so — like the
// ideas/board/scripts/content-links suites — this only runs where
// DATABASE_URL is available (local dev or a Vercel preview), not in CI
// (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping streams DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const STREAM_CARD_SELECTOR = '[data-slot="stream-card"]';
const EVENT_BLOCK_SELECTOR = '[data-slot="event-block"]';

const PREFIX = "[e2e-stream]";

/** Far enough out to have nothing else on the calendar, and distinct from other suites' own target dates. */
const target = new Date();
target.setHours(0, 0, 0, 0);
target.setDate(target.getDate() + 90);
const targetParam = formatDateParam(target);

/** Creates a stream through the real capture dialog, optionally planning a date. */
async function createStream(
  page: import("@playwright/test").Page,
  title: string,
  options: { date?: string; time?: string } = {}
) {
  await page.goto("/content/streams");
  await page.getByRole("button", { name: "New stream" }).click();
  const dialog = page.getByRole("dialog", { name: "New stream" });
  await dialog.getByLabel("Topic").fill(title);
  if (options.date) {
    await dialog.getByRole("switch", { name: "Plan a date" }).click();
    await dialog.getByLabel("Date", { exact: true }).fill(options.date);
    if (options.time) {
      await dialog.getByLabel("Start time").fill(options.time);
    }
  }
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10000 });
}

test.describe("stream session planner", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await clearTestStreams(PREFIX);
    await clearEventsWithPrefix(PREFIX);
    await clearTestTemplateItems(PREFIX);
  });

  test("editing the default checklist seeds those items onto a newly created stream", async ({
    page,
  }) => {
    const itemLabel = `${PREFIX} Check mic`;
    await page.goto("/content/streams");

    await page.getByRole("button", { name: "Default checklist" }).click();
    const templateDialog = page.getByRole("dialog", {
      name: "Default checklist",
    });
    await templateDialog
      .getByLabel("Add default checklist item")
      .fill(itemLabel);
    await templateDialog.getByRole("button", { name: "Add" }).click();
    await expect(templateDialog.getByText(itemLabel)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(templateDialog).not.toBeVisible();

    const title = `${PREFIX} Boss rush`;
    await createStream(page, title);

    await page.locator(STREAM_CARD_SELECTOR, { hasText: title }).click();
    await expect(page.getByText(itemLabel)).toBeVisible();
  });

  test("planning a date creates a content-track event, visible under Upcoming and on the calendar", async ({
    page,
  }) => {
    const title = `${PREFIX} Speedrun stream`;
    await createStream(page, title, { date: targetParam, time: "19:00" });

    await expect(page.getByText("Upcoming")).toBeVisible();
    await expect(
      page.locator(STREAM_CARD_SELECTOR, { hasText: title })
    ).toBeVisible();

    await page.goto(`/calendar?view=day&date=${targetParam}`);
    await expect(
      page.locator(EVENT_BLOCK_SELECTOR, { hasText: title })
    ).toBeVisible();
  });

  test("toggling and adding per-stream checklist items persists across reload", async ({
    page,
  }) => {
    const title = `${PREFIX} Checklist stream`;
    await createStream(page, title);

    await page.locator(STREAM_CARD_SELECTOR, { hasText: title }).click();

    const itemLabel = "Warm up voice";
    await page.getByLabel("Add checklist item").fill(itemLabel);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText(itemLabel)).toBeVisible();
    const checkbox = page.getByRole("checkbox", { name: itemLabel });
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    await page.reload();
    await expect(page.getByRole("checkbox", { name: itemLabel })).toBeChecked();
  });

  test("writing retro notes saves and survives a reload", async ({ page }) => {
    const title = `${PREFIX} Past stream`;
    await createStream(page, title);

    await page.locator(STREAM_CARD_SELECTOR, { hasText: title }).click();
    const retroNotes = page.locator('[data-slot="stream-retro-notes"]');
    const notes = "Great energy, chat was active.";
    await page.getByLabel("How did it go?").fill(notes);
    await retroNotes.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("How did it go?")).toHaveValue(notes);
  });

  test("deleting the linked calendar event leaves the stream unscheduled", async ({
    page,
  }) => {
    const title = `${PREFIX} Unschedule me`;
    await createStream(page, title, { date: targetParam, time: "20:00" });

    await page.goto(`/calendar?view=day&date=${targetParam}`);
    await page.locator(EVENT_BLOCK_SELECTOR, { hasText: title }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit event" });
    await editDialog.getByRole("button", { name: "Delete" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(editDialog).not.toBeVisible({ timeout: 10000 });

    // A single `page.goto` only fetches once — Playwright's own polling on
    // the resulting (already-loaded) DOM can't help if that one server
    // response raced the just-committed delete (Neon's HTTP driver can lag
    // read-after-write by a few hundred ms). `toPass` retries the whole
    // navigation, not just the assertion, so it re-fetches until the
    // now-unscheduled row is what comes back.
    await expect(async () => {
      await page.goto("/content/streams");
      const card = page.locator(STREAM_CARD_SELECTOR, { hasText: title });
      await expect(card).toBeVisible();
      await expect(card.getByText("Unscheduled")).toBeVisible({
        timeout: 1000,
      });
    }).toPass({ timeout: 10000 });
  });
});

// A separate prefix, so this describe (no file-level `serial` mode of its
// own) can run concurrently with the main describe above without racing its
// `afterEach` cleanup — same precedent as content-links.spec.ts.
const MOBILE_PREFIX = "[e2e-stream-mobile]";

test.describe("stream session planner mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  test.afterEach(async () => {
    await clearTestStreams(MOBILE_PREFIX);
  });

  test("the floating 'New stream' button opens the dialog for one-handed capture", async ({
    page,
  }) => {
    const title = `${MOBILE_PREFIX} Mobile capture`;
    await page.goto("/content/streams");

    await page.getByRole("button", { name: "New stream" }).click();
    const dialog = page.getByRole("dialog", { name: "New stream" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Topic")).toBeFocused();
    await dialog.getByLabel("Topic").fill(title);
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(
      page.locator(STREAM_CARD_SELECTOR, { hasText: title })
    ).toBeVisible();
  });
});
