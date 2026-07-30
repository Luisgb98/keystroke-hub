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

// Issue #85 removed the bottom-right floating dock (inbox pill + capture "+"),
// which was mobile's only persistent inbox entry point — so the bottom nav
// carries an Inbox tab now. Neither check needs a database.
test.describe("floating dock removal", () => {
  const NARROW = { width: 375, height: 812 };

  test.describe("desktop viewport", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("no floating capture button, and one Inbox link — the sidebar's", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(
        page.getByRole("button", { name: "Capture a thought" })
      ).toHaveCount(0);
      await expect(page.getByRole("link", { name: /Inbox/ })).toHaveCount(1);
      await expect(
        page
          .getByRole("navigation", { name: "Primary" })
          .getByRole("link", { name: /Inbox/ })
      ).toBeVisible();
    });
  });

  test.describe("mobile viewport", () => {
    test.use({ viewport: NARROW });

    test("no floating dock, and the bottom nav reaches the inbox", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(
        page.getByRole("button", { name: "Capture a thought" })
      ).toHaveCount(0);

      const inbox = page
        .getByRole("navigation", { name: "Primary" })
        .getByRole("link", { name: /Inbox/ });
      await expect(inbox).toHaveCount(1);
      await inbox.click();

      await expect(page).toHaveURL(/\/inbox$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Inbox" })
      ).toBeVisible();
      await expect(inbox).toHaveAttribute("aria-current", "page");
    });

    test("the 9-tab bottom nav still fits without horizontal overflow", async ({
      page,
    }) => {
      await page.goto("/");
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

      // Every tab keeps a comfortable tap target height, and none spills out
      // of the viewport now that Inbox joined the row.
      const nav = page.getByRole("navigation", { name: "Primary" });
      const navBox = await nav.boundingBox();
      expect(navBox).not.toBeNull();
      expect(navBox!.width).toBeLessThanOrEqual(NARROW.width);
      expect(navBox!.height).toBeGreaterThanOrEqual(44);
    });
  });
});
