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

/** Fills and submits the capture dialog, whichever surface opened it. */
async function fillCapture(page: Page, body: string) {
  const dialog = page.getByRole("dialog", { name: "Capture a thought" });
  await dialog.getByLabel("What's on your mind?").fill(body);
  await dialog.getByRole("button", { name: "Capture" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10000 });
}

/**
 * Captures a thought from any page via the palette's "Capture a thought"
 * action — the from-anywhere flow since #85 retired the floating dock.
 */
async function capture(page: Page, body: string) {
  const palette = page.getByRole("dialog", { name: "Command palette" });
  // Retry the press: the shortcut is bound by a client effect, so on a freshly
  // loaded page the first one can land before hydration (same guard as
  // e2e/command-palette.spec.ts).
  await expect(async () => {
    await page.keyboard.press("Control+f");
    await expect(palette).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await palette.getByRole("option", { name: "Capture a thought" }).click();
  await fillCapture(page, body);
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
    // #88: the idea destination asks for a Description, not "Notes".
    await expect(dialog.getByLabel("Description")).toBeVisible();
    await expect(dialog.getByLabel("Notes")).toHaveCount(0);
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

    // `capture` is the palette flow: shortcut → "Capture a thought" action.
    await capture(page, body);

    await page.goto("/inbox");
    await expect(page.locator(ENTRY_SELECTOR, { hasText: body })).toBeVisible();
  });

  test("captures from the inbox page's own capture button (#85)", async ({
    page,
  }) => {
    const body = `${PREFIX} inbox page capture button`;
    await page.goto("/inbox");

    await page.getByRole("button", { name: "Capture a thought" }).click();
    await fillCapture(page, body);

    await expect(page.locator(ENTRY_SELECTOR, { hasText: body })).toBeVisible({
      timeout: 10000,
    });
  });

  test("the retired floating dock is gone from every page (#85)", async ({
    page,
  }) => {
    await page.goto("/calendar");

    // No floating capture "+": off the inbox page, capture lives in the
    // palette only, so there's no capture control on /calendar at all.
    await expect(
      page.getByRole("button", { name: "Capture a thought" })
    ).toHaveCount(0);

    // And exactly one Inbox link — the nav's, not a floating pill on top of it.
    const inboxLinks = page.getByRole("link", { name: /Inbox/ });
    await expect(inboxLinks).toHaveCount(1);
    await expect(
      page
        .getByRole("navigation", { name: "Primary" })
        .getByRole("link", { name: /Inbox/ })
    ).toBeVisible();
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

  test("capture is reachable one-handed: bottom-nav Search → palette action", async ({
    page,
  }) => {
    // Unique per run: this describe isn't serial, so two copies (a retry, or a
    // `--repeat-each` run) can overlap, and each one's prefix cleanup would
    // otherwise delete the other's entry mid-test.
    const body = `${MOBILE_PREFIX} one-handed capture ${Date.now()}`;
    await page.goto("/calendar");

    const bottomNav = page.getByRole("navigation", { name: "Primary" });
    await bottomNav.getByRole("button", { name: "Search" }).click();
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeVisible();
    await palette.getByRole("option", { name: "Capture a thought" }).click();
    await fillCapture(page, body);

    // The bottom nav's Inbox tab — mobile's only persistent inbox entry point
    // since the dock went away — shows the fresh count and reaches the list.
    await expect(bottomNav.locator('[data-slot="inbox-count"]')).toBeVisible({
      timeout: 10000,
    });
    await bottomNav.getByRole("link", { name: /Inbox/ }).click();
    await expect(page).toHaveURL(/\/inbox$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Inbox" })
    ).toBeVisible();

    // The list is asserted after a reload: a client-side nav can be served from
    // the router cache, which may hold a payload prefetched before the capture.
    await page.reload();
    await expect(page.locator(ENTRY_SELECTOR, { hasText: body })).toBeVisible({
      timeout: 10000,
    });
  });

  test("no floating dock remains at a mobile viewport (#85)", async ({
    page,
  }) => {
    await page.goto("/calendar");

    await expect(
      page.getByRole("button", { name: "Capture a thought" })
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Inbox/ })).toHaveCount(1);
  });
});
