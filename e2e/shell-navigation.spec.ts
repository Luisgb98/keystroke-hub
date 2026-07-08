import { expect, test } from "@playwright/test";

import { navItems } from "../lib/navigation";

test.describe("app shell navigation", () => {
  test("navigates through all 5 areas, updating URL, heading, and active state", async ({
    page,
  }) => {
    await page.goto("/");

    for (const item of navItems) {
      // Scoped to the primary nav landmark (not the whole page) — a host
      // page's own content (e.g. the dashboard's "View calendar →" link)
      // can otherwise substring-match a nav label like "Calendar" and,
      // depending on DOM order, outrank the real nav link under `.first()`.
      const link = page
        .getByRole("navigation", { name: "Primary" })
        .getByRole("link", { name: item.label })
        .first();
      await link.click();

      await expect(page).toHaveURL(
        item.href === "/" ? /\/$/ : new RegExp(`${item.href}$`)
      );
      await expect(
        page.getByRole("heading", { level: 1, name: item.label })
      ).toBeVisible();
      await expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  test("keyboard: tab reaches a nav item and Enter navigates", async ({
    page,
  }) => {
    await page.goto("/");

    // Scoped to the primary nav landmark — see the comment above.
    const calendarLink = page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Calendar" })
      .first();
    await calendarLink.focus();
    await expect(calendarLink).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Calendar" })
    ).toBeVisible();
  });
});

test.describe("responsive nav contract", () => {
  test.describe("desktop viewport", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("shows the sidebar and hides the bottom bar", async ({ page }) => {
      await page.goto("/");
      await expect(
        page.getByRole("navigation", { name: "Primary" })
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Dashboard" }).first()
      ).toBeVisible();
      // A dashboard-sized viewport puts the sidebar's wordmark on screen.
      await expect(page.getByText("Keystroke")).toBeVisible();
    });
  });

  test.describe("mobile viewport", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("shows the bottom bar and hides the sidebar wordmark", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(
        page.getByRole("navigation", { name: "Primary" })
      ).toBeVisible();
      await expect(page.getByText("Keystroke")).toBeHidden();
    });
  });
});
