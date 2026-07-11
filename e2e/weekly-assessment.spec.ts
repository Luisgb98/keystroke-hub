import { expect, test } from "@playwright/test";

import { formatDateParam } from "../lib/journal/dates";
import { shiftWeekParam, weekStartParam } from "../lib/journal/week-dates";
import { clearTestWeeklyReviews } from "./support/daily-logs-db";

// The weekly assessment lives on the week summary page, which queries the
// database on every render — like weekly-summary.spec.ts, this only runs
// where DATABASE_URL is available (local dev or a Vercel preview), not in
// CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping weekly assessment DB-backed checks. " +
  "Set it locally (see .env.example) or on a Vercel preview to exercise this.";

const PREFIX = "[e2e-weekly-assessment]";

/**
 * Its own far-future window, distinct from journal.spec.ts's (+150),
 * weekly-summary.spec.ts's (+200), and mobile.spec.ts's weekly-summary
 * window (+210).
 */
const target = new Date();
target.setDate(target.getDate() + 250);
const targetParam = formatDateParam(target);
const weekStart = weekStartParam(targetParam);
const prevWeekStart = shiftWeekParam(weekStart, -1);
const nextWeekStart = shiftWeekParam(weekStart, 1);

test.describe("weekly assessment", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await clearTestWeeklyReviews(prevWeekStart, nextWeekStart);
  });

  test("filling in a rating and reflection prompts persists after a reload", async ({
    page,
  }) => {
    await page.goto(`/journal/week?week=${weekStart}`);

    await page.getByRole("radio", { name: "Strong" }).click();
    await expect(page.getByRole("radio", { name: "Strong" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    await page
      .getByLabel("What went well?")
      .fill(`${PREFIX} Shipped the release`);
    await page
      .getByLabel("What drained you?")
      .fill(`${PREFIX} Too many meetings`);
    await page
      .getByLabel("One thing to change next week")
      .fill(`${PREFIX} Block focus time`);
    await expect(page.getByText("Saved").last()).toBeVisible({
      timeout: 5000,
    });

    await page.reload();

    await expect(page.getByRole("radio", { name: "Strong" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await expect(page.getByLabel("What went well?")).toHaveValue(
      `${PREFIX} Shipped the release`
    );
    await expect(page.getByLabel("What drained you?")).toHaveValue(
      `${PREFIX} Too many meetings`
    );
    await expect(page.getByLabel("One thing to change next week")).toHaveValue(
      `${PREFIX} Block focus time`
    );
  });

  test("editing an existing assessment updates it in place rather than duplicating it", async ({
    page,
  }) => {
    await page.goto(`/journal/week?week=${weekStart}`);

    await page.getByLabel("What went well?").fill(`${PREFIX} First draft`);
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });

    await page.reload();
    await expect(page.getByLabel("What went well?")).toHaveValue(
      `${PREFIX} First draft`
    );

    await page.getByLabel("What went well?").fill(`${PREFIX} Revised`);
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });

    await page.reload();
    await expect(page.getByLabel("What went well?")).toHaveValue(
      `${PREFIX} Revised`
    );
  });

  test("a different week's assessment doesn't bleed into this one", async ({
    page,
  }) => {
    await page.goto(`/journal/week?week=${weekStart}`);
    await page.getByRole("radio", { name: "Great" }).click();
    await page.getByLabel("What went well?").fill(`${PREFIX} This week's win`);
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });

    await page.goto(`/journal/week?week=${nextWeekStart}`);

    await expect(page.getByRole("radio", { name: "Great" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    await expect(page.getByLabel("What went well?")).toHaveValue("");
  });

  test("the assessment trend view is reachable from the week page", async ({
    page,
  }) => {
    await page.goto(`/journal/week?week=${weekStart}`);

    await page.getByRole("button", { name: "Trend" }).click();

    await expect(page).toHaveURL("/journal/week/trend");
    await expect(
      page.getByRole("heading", { name: "Assessment trend" })
    ).toBeVisible();
  });
});
