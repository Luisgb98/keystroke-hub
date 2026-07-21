import { expect, test } from "@playwright/test";

import {
  formatDateParam,
  shiftDateParam,
  todayParam,
} from "../lib/journal/dates";
import {
  clearTestDailyLogItemsByTitle,
  clearTestDailyLogs,
} from "./support/daily-logs-db";

// The journal pages query the database on every render, so — like the
// ideas/board/streams suites — this only runs where DATABASE_URL is
// available (local dev or a Vercel preview), not in CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping journal DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const PREFIX = "[e2e-journal]";

/** Far enough out to be isolated from other suites' fixture dates and from real day-to-day use. */
const target = new Date();
target.setDate(target.getDate() + 150);
const targetParam = formatDateParam(target);
const tomorrowParam = shiftDateParam(targetParam, 1);
const dayBeforeTargetParam = shiftDateParam(targetParam, -1);

test.describe("daily log", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await clearTestDailyLogs(dayBeforeTargetParam, tomorrowParam);
  });

  test("opens on today by default", async ({ page }) => {
    await page.goto("/journal");
    await expect(page.getByLabel("Jump to date")).toHaveValue(todayParam());
  });

  test("adding, checking off, and adding an ad-hoc done item persists across reload", async ({
    page,
  }) => {
    await page.goto(`/journal?date=${targetParam}`);

    await page.getByLabel("Add planned item").fill(`${PREFIX} Write the docs`);
    await page.keyboard.press("Enter");
    await page.getByLabel("Add planned item").fill(`${PREFIX} Fix the bug`);
    await page.keyboard.press("Enter");
    await expect(page.getByText(`${PREFIX} Write the docs`)).toBeVisible();

    await page
      .getByRole("checkbox", { name: `${PREFIX} Write the docs` })
      .click();
    await expect(
      page.getByRole("checkbox", { name: `${PREFIX} Write the docs` })
    ).toBeChecked();

    await page.getByLabel("Add done item").fill(`${PREFIX} Reviewed a PR`);
    await page.keyboard.press("Enter");
    await expect(page.getByText(`${PREFIX} Reviewed a PR`)).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: `${PREFIX} Write the docs` })
    ).toBeChecked();
    await expect(page.getByText(`${PREFIX} Fix the bug`)).toBeVisible();
    await expect(page.getByText(`${PREFIX} Reviewed a PR`)).toBeVisible();
  });

  test("retro and mood autosave and survive a reload", async ({ page }) => {
    await page.goto(`/journal?date=${targetParam}`);

    const retro = `${PREFIX} A focused, productive day.`;
    await page.getByLabel("How did today go?").fill(retro);
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });

    await page.getByRole("radio", { name: "Good" }).click();
    await page.waitForTimeout(300);

    await page.reload();
    await expect(page.getByLabel("How did today go?")).toHaveValue(retro);
    await expect(page.getByRole("radio", { name: "Good" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  test("rolling a single unfinished item over shows it struck-through today and planned tomorrow", async ({
    page,
  }) => {
    await page.goto(`/journal?date=${targetParam}`);

    const title = `${PREFIX} Ship the release`;
    await page.getByLabel("Add planned item").fill(title);
    await page.keyboard.press("Enter");
    await expect(page.getByText(title)).toBeVisible();

    await page
      .getByRole("button", { name: `Roll "${title}" over to tomorrow` })
      .click();
    await expect(page.getByText("→ rolled")).toBeVisible();

    // Neon's HTTP driver can lag read-after-write by a few hundred ms (same
    // precedent as streams.spec.ts's post-delete check) — `toPass` retries
    // the whole navigation, not just the assertion, so it re-fetches until
    // the just-rolled-over copy is what comes back.
    await expect(async () => {
      await page.goto(`/journal?date=${tomorrowParam}`);
      await expect(page.getByRole("checkbox", { name: title })).toBeVisible({
        timeout: 1000,
      });
    }).toPass({ timeout: 10000 });
  });

  test("'roll over all unfinished' moves every still-planned item to the next day", async ({
    page,
  }) => {
    await page.goto(`/journal?date=${targetParam}`);

    const titleA = `${PREFIX} Unfinished A`;
    const titleB = `${PREFIX} Unfinished B`;
    await page.getByLabel("Add planned item").fill(titleA);
    await page.keyboard.press("Enter");
    await page.getByLabel("Add planned item").fill(titleB);
    await page.keyboard.press("Enter");
    await expect(page.getByText(titleB)).toBeVisible();

    await page
      .getByRole("button", { name: "Roll over all unfinished" })
      .click();
    await expect(
      page.getByRole("button", { name: "Roll over all unfinished" })
    ).not.toBeVisible();

    await expect(async () => {
      await page.goto(`/journal?date=${tomorrowParam}`);
      await expect(page.getByRole("checkbox", { name: titleA })).toBeVisible({
        timeout: 1000,
      });
      await expect(page.getByRole("checkbox", { name: titleB })).toBeVisible({
        timeout: 1000,
      });
    }).toPass({ timeout: 10000 });
  });
});

test.describe("daily log — real-date interactions", () => {
  test.skip(skip, skipReason);

  const REAL_DATE_PREFIX = "[e2e-journal-real]";

  test.afterEach(async () => {
    await clearTestDailyLogItemsByTitle(REAL_DATE_PREFIX);
  });

  test("a real past day is browsable and editable, and standup shows yesterday's done + today's plan", async ({
    page,
  }) => {
    const yesterday = shiftDateParam(todayParam(), -1);
    const doneTitle = `${REAL_DATE_PREFIX} Shipped the feature`;
    const plannedTitle = `${REAL_DATE_PREFIX} Write the retro`;

    await page.goto(`/journal?date=${yesterday}`);
    await expect(page.getByText("Viewing a past day.")).toBeVisible();
    await page.getByLabel("Add done item").fill(doneTitle);
    await page.keyboard.press("Enter");
    await expect(page.getByText(doneTitle)).toBeVisible();

    await page.reload();
    await expect(page.getByText(doneTitle)).toBeVisible();

    await page.goto("/journal");
    await page.getByLabel("Add planned item").fill(plannedTitle);
    await page.keyboard.press("Enter");
    await expect(page.getByText(plannedTitle)).toBeVisible();

    await page.goto("/journal/standup");
    await expect(page.getByText(doneTitle)).toBeVisible();
    await expect(page.getByText(plannedTitle)).toBeVisible();
  });
});
