import { expect, test } from "@playwright/test";

import { formatDateParam } from "../lib/calendar/range";
import { clearEventsWithPrefix } from "./support/events-db";
import { clearTestIdeas, seedTestIdea } from "./support/ideas-db";

// Both the ideas list and the calendar query the database on every render,
// so — like the other DB-backed suites — this only runs where DATABASE_URL
// is available (local dev or a Vercel preview), not in CI (see
// docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping content-links DB-backed checks. " +
  "Set it locally (see .env.example) or on a Vercel preview to exercise this.";

const PREFIX = "[e2e-links]";

const IDEA_CARD_SELECTOR = '[data-slot="idea-card"]';
const EVENT_BLOCK_SELECTOR = '[data-slot="event-block"]';

/** Far enough out to have nothing else on the calendar, and distinct from event-management.spec.ts's own target date. */
const target = new Date();
target.setHours(0, 0, 0, 0);
target.setDate(target.getDate() + 75);
const targetParam = formatDateParam(target);

function longDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
const targetLongLabel = longDateLabel(target);

/** Creates a content-track event at 13:00 on `target` via the week-view slot, through the real UI. */
async function createContentEvent(
  page: import("@playwright/test").Page,
  title: string
) {
  await page.goto(`/calendar?view=week&date=${targetParam}`);
  await page
    .getByRole("button", { name: `Add event at 13:00 on ${targetLongLabel}` })
    .click();
  const dialog = page.getByRole("dialog", { name: "New event" });
  await dialog.getByRole("radio", { name: /content/i }).click();
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10000 });
}

async function createWorkEvent(
  page: import("@playwright/test").Page,
  title: string
) {
  await page.goto(`/calendar?view=week&date=${targetParam}`);
  await page
    .getByRole("button", { name: `Add event at 15:00 on ${targetLongLabel}` })
    .click();
  const dialog = page.getByRole("dialog", { name: "New event" });
  await dialog.getByRole("radio", { name: /work/i }).click();
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10000 });
}

test.describe("idea <-> event links", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await clearTestIdeas(PREFIX);
    await clearEventsWithPrefix(PREFIX);
  });

  test("linking an idea from the event editor shows it as scheduled on the idea card", async ({
    page,
  }) => {
    const ideaTitle = `${PREFIX} Boss rush commentary`;
    const eventTitle = `${PREFIX} Stream: boss rush`;
    await seedTestIdea({ title: ideaTitle });
    await createContentEvent(page, eventTitle);

    await page.locator(EVENT_BLOCK_SELECTOR, { hasText: eventTitle }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit event" });
    await expect(editDialog).toBeVisible();

    await editDialog.getByRole("button", { name: "Link an idea" }).click();
    const picker = page.getByRole("dialog", { name: "Link an idea" });
    await expect(picker).toBeVisible();
    await picker.getByText(ideaTitle).click();
    await expect(picker).not.toBeVisible({ timeout: 10000 });

    await expect(editDialog.getByText(ideaTitle)).toBeVisible();

    await page.goto("/content/ideas");
    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: ideaTitle });
    await expect(
      card.locator(`a[href="/calendar?view=day&date=${targetParam}"]`)
    ).toBeVisible();
  });

  test("opens the linked idea's script from the event editor", async ({
    page,
  }) => {
    const ideaTitle = `${PREFIX} Glitch tutorial`;
    const eventTitle = `${PREFIX} Record voiceover`;
    await seedTestIdea({ title: ideaTitle });

    // Write a script first, through the real UI, so the "Open script"
    // (rather than "Write script") label applies once linked.
    await page.goto("/content/ideas");
    await page
      .locator(IDEA_CARD_SELECTOR, { hasText: ideaTitle })
      .getByRole("link", { name: /script for/ })
      .click();
    await page
      .getByLabel("Script", { exact: true })
      .fill("# Cold open\n\nHook them fast.");
    await expect(page.getByText(/^Saved \d{2}:\d{2}$/)).toBeVisible({
      timeout: 10000,
    });

    await createContentEvent(page, eventTitle);
    await page.locator(EVENT_BLOCK_SELECTOR, { hasText: eventTitle }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit event" });
    await editDialog.getByRole("button", { name: "Link an idea" }).click();
    const picker = page.getByRole("dialog", { name: "Link an idea" });
    await picker.getByText(ideaTitle).click();
    await expect(picker).not.toBeVisible({ timeout: 10000 });

    await editDialog
      .getByRole("link", { name: `Open script for "${ideaTitle}"` })
      .click();

    await expect(page.getByLabel("Script", { exact: true })).toHaveValue(
      "# Cold open\n\nHook them fast."
    );
  });

  test("unlinking from the idea side removes it from the event editor", async ({
    page,
  }) => {
    const ideaTitle = `${PREFIX} Speedrun any%`;
    const eventTitle = `${PREFIX} Practice stream`;
    await seedTestIdea({ title: ideaTitle });
    await createContentEvent(page, eventTitle);

    await page.locator(EVENT_BLOCK_SELECTOR, { hasText: eventTitle }).click();
    let editDialog = page.getByRole("dialog", { name: "Edit event" });
    await editDialog.getByRole("button", { name: "Link an idea" }).click();
    const picker = page.getByRole("dialog", { name: "Link an idea" });
    await picker.getByText(ideaTitle).click();
    await expect(picker).not.toBeVisible({ timeout: 10000 });
    await expect(editDialog.getByText(ideaTitle)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(editDialog).not.toBeVisible();

    await page.goto("/content/ideas");
    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: ideaTitle });
    await card
      .getByRole("button", { name: `Unlink from "${eventTitle}"` })
      .click();
    await expect(
      card.locator(`a[href="/calendar?view=day&date=${targetParam}"]`)
    ).toHaveCount(0);

    await page.goto(`/calendar?view=week&date=${targetParam}`);
    await page.locator(EVENT_BLOCK_SELECTOR, { hasText: eventTitle }).click();
    editDialog = page.getByRole("dialog", { name: "Edit event" });
    await expect(editDialog.getByText("No ideas linked yet.")).toBeVisible();
    await expect(editDialog.getByText(ideaTitle)).not.toBeVisible();
  });

  test("a work-track event has no linking UI at all", async ({ page }) => {
    const eventTitle = `${PREFIX} 1:1 with manager`;
    await createWorkEvent(page, eventTitle);

    await page.locator(EVENT_BLOCK_SELECTOR, { hasText: eventTitle }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit event" });
    await expect(editDialog).toBeVisible();

    await expect(editDialog.getByText("Linked content")).not.toBeVisible();
    await expect(
      editDialog.getByRole("button", { name: "Link an idea" })
    ).not.toBeVisible();
  });
});

// A separate prefix from the main describe above: Playwright can run this
// describe concurrently with it in a different worker (this file has no
// file-level `serial` mode, only the main describe's own), and a shared
// prefix would mean this block's `afterEach` wipes rows the main describe's
// still-running test depends on, since both clear by `LIKE '<prefix>%'`.
const MOBILE_PREFIX = "[e2e-links-mobile]";

test.describe("idea <-> event links mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  test.afterEach(async () => {
    await clearTestIdeas(MOBILE_PREFIX);
    await clearEventsWithPrefix(MOBILE_PREFIX);
  });

  test("links an idea from the event editor one-handed, with no horizontal overflow", async ({
    page,
  }) => {
    const ideaTitle = `${MOBILE_PREFIX} Mobile boss rush`;
    const eventTitle = `${MOBILE_PREFIX} Mobile stream`;
    await seedTestIdea({ title: ideaTitle });

    // Week view's time-grid slot buttons (used by `createContentEvent`) are
    // desktop-only — week view swaps to a mobile agenda list instead (see
    // docs/calendar.md). The header "New event" button is the established
    // mobile creation path (same precedent as event-management.spec.ts's
    // mobile suite); it always defaults to "now", so this uses today rather
    // than `target`.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await page.goto(`/calendar?view=day&date=${formatDateParam(today)}`);
    await page.getByRole("button", { name: "New event" }).click();
    const newDialog = page.getByRole("dialog", { name: "New event" });
    await newDialog.getByRole("radio", { name: /content/i }).click();
    await newDialog.getByLabel("Title").fill(eventTitle);
    await newDialog.getByRole("button", { name: "Save" }).click();
    await expect(newDialog).not.toBeVisible({ timeout: 10000 });

    await page.locator(EVENT_BLOCK_SELECTOR, { hasText: eventTitle }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit event" });
    await editDialog.getByRole("button", { name: "Link an idea" }).click();
    const picker = page.getByRole("dialog", { name: "Link an idea" });
    await expect(picker).toBeVisible();
    await picker.getByText(ideaTitle).click();
    await expect(picker).not.toBeVisible({ timeout: 10000 });

    await expect(editDialog.getByText(ideaTitle)).toBeVisible();
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
