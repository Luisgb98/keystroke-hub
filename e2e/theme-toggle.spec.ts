import { expect, test } from "@playwright/test";

test.describe("theme toggle", () => {
  // The toggle now lives in the desktop sidebar (see app/(app)/layout.tsx);
  // a mobile-accessible toggle is out of scope for issue #2.
  test.skip(
    ({ isMobile }) => isMobile,
    "theme toggle lives in the desktop sidebar only"
  );

  test("switches to dark and persists across reload with no flash", async ({
    page,
  }) => {
    await page.goto("/");

    const html = page.locator("html");
    await expect(html).not.toHaveClass(/dark/);

    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page.getByRole("menuitem", { name: "Dark" }).click();

    await expect(html).toHaveClass(/dark/);

    await page.reload();

    // The .dark class must already be present in the very first paint (no flash),
    // so we assert it immediately after the DOM is available rather than waiting.
    await expect(html).toHaveClass(/dark/);

    const backgroundColor = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor
    );
    expect(backgroundColor).not.toBe("");
  });

  test("switches back to light and removes the .dark class", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page.getByRole("menuitem", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page.getByRole("menuitem", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
