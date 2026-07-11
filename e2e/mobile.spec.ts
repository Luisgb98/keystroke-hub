import { expect, test } from "@playwright/test";

import { clearTestDailyLogItemsByTitle } from "./support/daily-logs-db";

test.use({ viewport: { width: 375, height: 812 } });

test.describe("mobile viewport", () => {
  test("home page has no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("styleguide page has no horizontal overflow and a usable sticky nav", async ({
    page,
  }) => {
    await page.goto("/styleguide");
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    const nav = page.getByRole("navigation", { name: "Styleguide sections" });
    await expect(nav).toBeVisible();

    await page.getByRole("link", { name: "Components" }).click();
    await expect(nav).toBeInViewport();
  });
});

// The journal's core ritual needs a real database, so — like the streams
// mobile-viewport suite — this is skipped where DATABASE_URL isn't set
// (see docs/database.md).
test.describe("journal mobile viewport", () => {
  const skip = !process.env.DATABASE_URL;
  test.skip(
    skip,
    "DATABASE_URL is not set — skipping the journal mobile DB-backed check."
  );

  const PREFIX = "[e2e-journal-mobile]";

  test.afterEach(async () => {
    await clearTestDailyLogItemsByTitle(PREFIX);
  });

  test("filling in today's plan is one input + Enter, no horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/journal");
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    const title = `${PREFIX} Quick capture`;
    await page.getByLabel("Add planned item").fill(title);
    await page.keyboard.press("Enter");
    await expect(page.getByText(title)).toBeVisible();
  });
});
