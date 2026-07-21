import { expect, test, type Page } from "@playwright/test";

import { clearTestDailyLogItemsByTitle } from "./support/daily-logs-db";
import { clearTestIdeas } from "./support/ideas-db";
import { clearTestInboxEntries } from "./support/inbox-db";

// The inbox pages query the database on every render, so — like the
// projects/improvements/meetings suites — this only runs where DATABASE_URL
// is available (local dev or a Vercel preview), not in CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping inbox DB-backed checks. Set it locally " +
  "(see .env.example) or on a Vercel preview to exercise this.";

const PREFIX = "[e2e-inbox]";
const ENTRY_SELECTOR = '[data-slot="inbox-entry"]';

/** Captures a thought via the global floating capture button — the two-tap flow. */
async function capture(page: Page, body: string) {
  await page.getByRole("button", { name: "Capture a thought" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("What's on your mind?").fill(body);
  await dialog.getByRole("button", { name: "Capture" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10000 });
}

test.describe("quick-capture inbox", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await clearTestInboxEntries(PREFIX);
    await clearTestIdeas(PREFIX);
    await clearTestDailyLogItemsByTitle(PREFIX);
  });

  test("captures from a non-inbox page in two taps and shows it in the inbox", async ({
    page,
  }) => {
    const body = `${PREFIX} buy a shock mount`;
    // Start somewhere that is not the inbox — capture must work anywhere.
    await page.goto("/calendar");
    await capture(page, body);

    // The sidebar count badge reflects the new entry.
    await expect(page.locator('[data-slot="inbox-count"]').first()).toBeVisible(
      { timeout: 10000 }
    );

    await page.goto("/inbox");
    await expect(page.locator(ENTRY_SELECTOR, { hasText: body })).toBeVisible();
  });

  test("triages an entry into a content idea, prefilled, and it leaves the inbox", async ({
    page,
  }) => {
    const body = `${PREFIX} Retro of the marathon`;
    await page.goto("/inbox");
    await capture(page, body);

    const entry = page.locator(ENTRY_SELECTOR, { hasText: body });
    await entry.getByRole("button", { name: "Triage" }).click();
    await page.getByRole("menuitem", { name: "Content idea" }).click();

    const dialog = page.getByRole("dialog");
    // Prefill: the captured text arrives in the idea's title field.
    await expect(dialog.getByLabel("Title")).toHaveValue(body);
    await dialog.getByRole("button", { name: /Send to/ }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // The entry has left the inbox…
    await expect(
      page.locator(ENTRY_SELECTOR, { hasText: body })
    ).not.toBeVisible({ timeout: 10000 });

    // …and now exists as an idea.
    await page.goto("/content/ideas");
    await expect(page.getByText(body)).toBeVisible();
  });

  test("triages an entry onto today's log", async ({ page }) => {
    const body = `${PREFIX} email the sponsor back`;
    await page.goto("/inbox");
    await capture(page, body);

    const entry = page.locator(ENTRY_SELECTOR, { hasText: body });
    await entry.getByRole("button", { name: "Triage" }).click();
    await page.getByRole("menuitem", { name: "Today's log" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Title")).toHaveValue(body);
    await dialog.getByRole("button", { name: /Send to/ }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await expect(
      page.locator(ENTRY_SELECTOR, { hasText: body })
    ).not.toBeVisible({ timeout: 10000 });

    await page.goto("/journal");
    await expect(page.getByText(body)).toBeVisible();
  });

  test("discards an entry after confirming", async ({ page }) => {
    const body = `${PREFIX} random shower thought`;
    await page.goto("/inbox");
    await capture(page, body);

    const entry = page.locator(ENTRY_SELECTOR, { hasText: body });
    await entry.getByRole("button", { name: "Discard" }).click();

    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("button", { name: "Discard" }).click();

    await expect(
      page.locator(ENTRY_SELECTOR, { hasText: body })
    ).not.toBeVisible({ timeout: 10000 });
  });

  test("captures via the command palette action", async ({ page }) => {
    const body = `${PREFIX} palette capture works`;
    await page.goto("/");

    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeVisible();
    await palette.getByRole("option", { name: "Capture a thought" }).click();

    const capture = page.getByRole("dialog");
    await capture.getByLabel("What's on your mind?").fill(body);
    await capture.getByRole("button", { name: "Capture" }).click();

    await page.goto("/inbox");
    await expect(page.locator(ENTRY_SELECTOR, { hasText: body })).toBeVisible();
  });
});

// A separate prefix so the mobile describe can run alongside the main one
// without racing its cleanup — same precedent as improvements.spec.ts.
const MOBILE_PREFIX = "[e2e-inbox-mobile]";

test.describe("quick-capture inbox mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  test.afterEach(async () => {
    await clearTestInboxEntries(MOBILE_PREFIX);
  });

  test("the floating capture button is reachable one-handed", async ({
    page,
  }) => {
    const body = `${MOBILE_PREFIX} one-handed capture`;
    await page.goto("/calendar");
    await capture(page, body);

    await page.goto("/inbox");
    await expect(page.locator(ENTRY_SELECTOR, { hasText: body })).toBeVisible({
      timeout: 10000,
    });
  });
});
