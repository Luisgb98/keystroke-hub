import { expect, test } from "@playwright/test";

import { formatDateParam } from "../lib/journal/dates";
import {
  formatWeekLabel,
  shiftWeekParam,
  weekDayParams,
  weekStartParam,
} from "../lib/journal/week-dates";
import {
  clearTestDailyLogItemsByTitle,
  clearTestDailyLogs,
  clearTestWeeklyReviews,
} from "./support/daily-logs-db";

// The weekly summary queries the database on every render, so — like the
// journal suite it builds on — this only runs where DATABASE_URL is
// available (local dev or a Vercel preview), not in CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping weekly summary DB-backed checks. Set " +
  "it locally (see .env.example) or on a Vercel preview to exercise this.";

const PREFIX = "[e2e-weekly-summary]";

/**
 * Far enough out to be isolated from journal.spec.ts's own far-future
 * window (target + 150 days) and from real day-to-day use.
 */
const target = new Date();
target.setDate(target.getDate() + 200);
const targetParam = formatDateParam(target);
const weekStart = weekStartParam(targetParam);
const prevWeekStart = shiftWeekParam(weekStart, -1);
const nextWeekStart = shiftWeekParam(weekStart, 1);
const [monday, tuesday] = weekDayParams(weekStart);

test.describe("weekly summary", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await clearTestDailyLogs(prevWeekStart, nextWeekStart);
    await clearTestWeeklyReviews(prevWeekStart, nextWeekStart);
  });

  test("groups done items by day and shows a day's retro", async ({ page }) => {
    await page.goto(`/journal?date=${monday}`);
    await page.getByLabel("Add done item").fill(`${PREFIX} Shipped the thing`);
    await page.keyboard.press("Enter");
    await expect(page.getByText(`${PREFIX} Shipped the thing`)).toBeVisible();

    await page.goto(`/journal?date=${tuesday}`);
    await page.getByLabel("How did today go?").fill(`${PREFIX} A focused day.`);
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });

    // Neon's HTTP driver can lag read-after-write by a few hundred ms (same
    // precedent as journal.spec.ts) — `toPass` retries the whole
    // navigation, not just the assertion.
    await expect(async () => {
      await page.goto(`/journal/week?week=${weekStart}`);
      await expect(page.getByText(`${PREFIX} Shipped the thing`)).toBeVisible({
        timeout: 1000,
      });
    }).toPass({ timeout: 10000 });

    await expect(page.getByText(`${PREFIX} A focused day.`)).toBeVisible();
  });

  test("navigating to the previous/next week and deep-linking to a specific week works", async ({
    page,
  }) => {
    await page.goto(`/journal/week?week=${weekStart}`);
    await expect(page.getByText(formatWeekLabel(weekStart))).toBeVisible();

    await page.getByRole("button", { name: "Previous week" }).click();
    await expect(page).toHaveURL(`/journal/week?week=${prevWeekStart}`);
    await expect(page.getByText(formatWeekLabel(prevWeekStart))).toBeVisible();

    await page.getByRole("button", { name: "Next week" }).click();
    await expect(page).toHaveURL(`/journal/week?week=${weekStart}`);
  });

  test("editing highlights autosaves and survives a reload", async ({
    page,
  }) => {
    await page.goto(`/journal/week?week=${weekStart}`);

    const highlights = `${PREFIX} Big release week.`;
    await page.getByLabel("Highlights").fill(highlights);
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });

    await page.reload();
    await expect(page.getByLabel("Highlights")).toHaveValue(highlights);
  });

  test("a rolled-over item appears exactly once under Carried over", async ({
    page,
  }) => {
    const title = `${PREFIX} Unfinished task`;

    await page.goto(`/journal?date=${monday}`);
    await page.getByLabel("Add planned item").fill(title);
    await page.keyboard.press("Enter");
    await expect(page.getByText(title)).toBeVisible();

    await page
      .getByRole("button", { name: `Roll "${title}" over to tomorrow` })
      .click();
    await expect(page.getByText("→ rolled")).toBeVisible();

    await expect(async () => {
      await page.goto(`/journal/week?week=${weekStart}`);
      await expect(page.getByText("Carried over")).toBeVisible({
        timeout: 1000,
      });
    }).toPass({ timeout: 10000 });

    await expect(page.getByText(title)).toHaveCount(1);
  });

  test("copying the summary writes Markdown to the clipboard", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Clipboard permissions are only reliably grantable in Chromium."
    );
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto(`/journal?date=${monday}`);
    await page
      .getByLabel("Add done item")
      .fill(`${PREFIX} Copy me into the summary`);
    await page.keyboard.press("Enter");
    await expect(
      page.getByText(`${PREFIX} Copy me into the summary`)
    ).toBeVisible();

    await expect(async () => {
      await page.goto(`/journal/week?week=${weekStart}`);
      await expect(
        page.getByText(`${PREFIX} Copy me into the summary`)
      ).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });

    await page.getByRole("button", { name: "Copy as Markdown" }).click();
    await expect(page.getByText("Copied the week's summary")).toBeVisible();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText()
    );
    expect(clipboardText).toContain(`# Week of ${formatWeekLabel(weekStart)}`);
    expect(clipboardText).toContain(`${PREFIX} Copy me into the summary`);
  });

  test("an invalid week param falls back to the current week", async ({
    page,
  }) => {
    await page.goto("/journal/week?week=not-a-week");
    await expect(
      page.getByRole("heading", { name: "Week in review" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "This week" })
    ).not.toBeVisible();
  });
});

test.describe("weekly summary — real-date interactions", () => {
  test.skip(skip, skipReason);

  const REAL_WEEK_PREFIX = "[e2e-weekly-summary-real]";

  test.afterEach(async () => {
    await clearTestDailyLogItemsByTitle(REAL_WEEK_PREFIX);
  });

  test("the current week's summary is reachable from the journal page", async ({
    page,
  }) => {
    const title = `${REAL_WEEK_PREFIX} Today's win`;

    await page.goto("/journal");
    await page.getByLabel("Add done item").fill(title);
    await page.keyboard.press("Enter");
    await expect(page.getByText(title)).toBeVisible();

    await page.getByRole("button", { name: "Week", exact: true }).click();
    await expect(page).toHaveURL(/\/journal\/week/);
    await expect(page.getByText(title)).toBeVisible();
  });
});
