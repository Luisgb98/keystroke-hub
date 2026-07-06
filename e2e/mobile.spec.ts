import { expect, test } from "@playwright/test";

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
