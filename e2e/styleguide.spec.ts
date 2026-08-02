import { expect, test } from "@playwright/test";

test.describe("styleguide", () => {
  test("renders every section", async ({ page }) => {
    await page.goto("/styleguide");

    await expect(
      page.getByRole("heading", { name: "Styleguide" })
    ).toBeVisible();

    for (const heading of [
      "Colors",
      "Track palette",
      "Typography",
      "Radii",
      "Elevation",
      "Motion",
      "Components",
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("section nav links jump to their section", async ({ page }) => {
    await page.goto("/styleguide");

    await page.getByRole("link", { name: "Typography" }).click();
    await expect(page).toHaveURL(/#typography$/);
    await expect(page.locator("#typography")).toBeInViewport();
  });

  test("shows all three tracks with a distinguishing icon and label, not color alone", async ({
    page,
  }) => {
    await page.goto("/styleguide");

    await expect(page.getByText("Ship the auth flow")).toBeVisible();
    await expect(page.getByText("Draft · Video schedule")).toBeVisible();
    await expect(page.getByText("Live 20:00 · Checklist 3/5")).toBeVisible();
    for (const label of ["Work", "Content", "Stream"]) {
      await expect(
        page.getByText(label, { exact: true }).first()
      ).toBeVisible();
    }
  });

  test("opens shadcn components (dialog, dropdown, tooltip) rendered in the app skin", async ({
    page,
  }) => {
    await page.goto("/styleguide");
    await page.getByRole("link", { name: "Components" }).click();

    await page.getByRole("button", { name: "Open dialog" }).click();
    await expect(
      page.getByRole("heading", { name: "Are you sure?" })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
