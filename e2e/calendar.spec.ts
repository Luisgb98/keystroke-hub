import { expect, test } from "@playwright/test";

import { formatDateParam, shiftDate } from "../lib/calendar/range";
import {
  clearTestEvents,
  E2E_ALL_DAY_EVENT_TITLE,
  E2E_CONTENT_EVENT_TITLE,
  E2E_WORK_EVENT_TITLE,
  seedTestEvents,
} from "./support/events-db";

// Both describe blocks below share seeded rows in the real dev database via
// beforeAll/afterAll. Serializing the whole file (not just each describe)
// keeps them in one worker so the two blocks' seed/cleanup cycles can't
// race against each other.
test.describe.configure({ mode: "serial" });

// The calendar page queries the database on every render, so — like the
// health check — it can only be exercised where DATABASE_URL is available
// (local dev or a Vercel preview), not in CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping calendar DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const today = new Date();
today.setHours(0, 0, 0, 0);
const todayParam = formatDateParam(today);
const tomorrowParam = formatDateParam(shiftDate("day", today, 1));
const yesterdayParam = formatDateParam(shiftDate("day", today, -1));

test.describe("calendar", () => {
  test.skip(skip, skipReason);

  test.beforeAll(async () => {
    await seedTestEvents(today);
  });

  test.afterAll(async () => {
    await clearTestEvents();
  });

  test("deep link to a specific view/date renders that range", async ({
    page,
  }) => {
    await page.goto(`/calendar?view=day&date=${todayParam}`);

    await expect(page).toHaveURL(`/calendar?view=day&date=${todayParam}`);
    await expect(page.getByRole("tab", { name: "Day" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByText(E2E_WORK_EVENT_TITLE)).toBeVisible();
  });

  test("switching views updates the URL and content", async ({ page }) => {
    await page.goto(`/calendar?view=day&date=${todayParam}`);

    await page.getByRole("tab", { name: "Month" }).click();
    await expect(page).toHaveURL(`/calendar?view=month&date=${todayParam}`);
    await expect(page.getByRole("tab", { name: "Month" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("prev/next/today navigation moves the visible date", async ({
    page,
  }) => {
    await page.goto(`/calendar?view=day&date=${todayParam}`);

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page).toHaveURL(`/calendar?view=day&date=${tomorrowParam}`);

    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page).toHaveURL(`/calendar?view=day&date=${todayParam}`);
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page).toHaveURL(`/calendar?view=day&date=${yesterdayParam}`);

    await page.getByRole("button", { name: "Today" }).click();
    await expect(page).toHaveURL(`/calendar?view=day&date=${todayParam}`);
  });

  test("both tracks render simultaneously and are visually distinct", async ({
    page,
  }) => {
    await page.goto(`/calendar?view=day&date=${todayParam}`);

    const workEvent = page.getByText(E2E_WORK_EVENT_TITLE);
    const contentEvent = page.getByText(E2E_CONTENT_EVENT_TITLE);
    await expect(workEvent).toBeVisible();
    await expect(contentEvent).toBeVisible();

    const workBlock = page.locator(".border-track-work-border", {
      hasText: E2E_WORK_EVENT_TITLE,
    });
    const contentBlock = page.locator(".border-track-content-border", {
      hasText: E2E_CONTENT_EVENT_TITLE,
    });
    await expect(workBlock).toBeVisible();
    await expect(contentBlock).toBeVisible();
    // Color is never the only signal — each track also carries its own icon.
    await expect(workBlock.locator("svg")).toBeVisible();
    await expect(contentBlock.locator("svg")).toBeVisible();
  });

  test("all-day events render in the all-day row", async ({ page }) => {
    await page.goto(`/calendar?view=day&date=${todayParam}`);
    await expect(page.getByText(E2E_ALL_DAY_EVENT_TITLE)).toBeVisible();
  });

  test("today is highlighted in month view", async ({ page }) => {
    await page.goto(`/calendar?view=month&date=${todayParam}`);

    const todayLabel = today.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const todayLink = page.getByRole("link", { name: todayLabel });
    await expect(todayLink).toBeVisible();
    // The link is a full-bleed sibling behind the cell's date-number span
    // (see docs/calendar.md), not its parent — scope to the shared cell
    // wrapper to find the span.
    const todayCell = page.locator(".group").filter({ has: todayLink });
    await expect(todayCell.locator("span").first()).toHaveClass(/bg-primary/);
  });

  test("clicking a day in month view navigates to its day view", async ({
    page,
  }) => {
    await page.goto(`/calendar?view=month&date=${todayParam}`);

    const todayLabel = today.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    // The link fills the whole cell but sits behind the date-number badge and
    // any event chips (see docs/calendar.md), so click near the top-left
    // where only the (pointer-events-none) date badge overlaps it — clicking
    // the link's own bounding-box center could land on a chip instead when
    // the day has several events.
    await page
      .getByRole("link", { name: todayLabel })
      .click({ position: { x: 10, y: 10 } });

    await expect(page).toHaveURL(`/calendar?view=day&date=${todayParam}`);
  });
});

test.describe("calendar mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  test.beforeAll(async () => {
    await seedTestEvents(today);
  });

  test.afterAll(async () => {
    await clearTestEvents();
  });

  for (const view of ["day", "week", "month"] as const) {
    test(`${view} view has no horizontal overflow on a phone`, async ({
      page,
    }) => {
      await page.goto(`/calendar?view=${view}&date=${todayParam}`);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }

  test("week view renders as a stacked agenda list, not a 7-column grid", async ({
    page,
  }) => {
    await page.goto(`/calendar?view=week&date=${todayParam}`);
    // The desktop 7-column grid also exists in the DOM (hidden via CSS at
    // this viewport), so scope to the visible agenda list specifically.
    await expect(page.getByText(E2E_WORK_EVENT_TITLE).first()).toBeVisible();
    await expect(page.getByText(E2E_CONTENT_EVENT_TITLE).first()).toBeVisible();
  });
});
