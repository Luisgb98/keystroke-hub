import { expect, test } from "@playwright/test";

import { bottomNavItems, moreNavItems } from "../lib/navigation";

test.describe("app shell navigation", () => {
  // Iterates the bar's four destinations rather than all five `navItems`:
  // this file runs under both the desktop and the mobile Playwright projects,
  // and #114 moved Projects & Meetings behind the mobile "More" sheet. The
  // sidebar carries all four too, so one loop covers both viewports; the fifth
  // gets a viewport-specific test of its own below.
  test("navigates through every bar destination, updating URL, heading, and active state", async ({
    page,
  }) => {
    await page.goto("/");

    for (const item of bottomNavItems) {
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

// #114 cut the bar from nine crammed items to four destinations plus "More".
// Nothing became unreachable — it just takes the sheet to get there.
test.describe("More sheet", () => {
  const NARROW = { width: 390, height: 844 };
  test.use({ viewport: NARROW });

  test("the bar holds five single-line slots inside the viewport", async ({
    page,
  }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Primary" });
    const navBox = await nav.boundingBox();
    expect(navBox).not.toBeNull();
    expect(navBox!.width).toBeLessThanOrEqual(NARROW.width);

    const slots = await nav.locator(":scope > *").all();
    expect(slots).toHaveLength(5);

    for (const slot of slots) {
      const box = await slot.boundingBox();
      expect(box).not.toBeNull();
      // Comfortably tappable, and no taller than the bar itself — a label
      // wrapping to a second line is what used to blow the row up to three.
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeLessThanOrEqual(navBox!.height);
    }

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("every label stays on one line", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Primary" });
    const labels = await nav.locator(":scope > * > span:last-child").all();
    expect(labels).toHaveLength(5);

    for (const label of labels) {
      // Height over line-height: anything at or above 2 is a wrapped label,
      // which is exactly what nine slots produced ("Projec ts & Meeti ngs").
      const lines = await label.evaluate((node) => {
        const style = getComputedStyle(node);
        return (
          node.getBoundingClientRect().height / parseFloat(style.lineHeight)
        );
      });
      expect(lines).toBeLessThan(1.5);
    }
  });

  test("reaches every moved destination in one tap from the bar", async ({
    page,
  }) => {
    await page.goto("/");

    for (const item of moreNavItems) {
      await page
        .getByRole("navigation", { name: "Primary" })
        .getByRole("button", { name: /More/ })
        .click();

      const sheet = page.getByRole("navigation", { name: "More" });
      await expect(sheet).toBeVisible();
      await sheet.getByRole("link", { name: new RegExp(item.label) }).click();

      await expect(page).toHaveURL(new RegExp(`${item.href}$`));
      // The sheet closes behind the tap rather than covering the destination.
      await expect(sheet).toBeHidden();
    }
  });

  test("highlights More while the route lives behind it", async ({ page }) => {
    await page.goto("/projects");

    const more = page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: /More/ });
    // The active destination has no slot of its own, so the trigger stands in
    // for it — otherwise the bar looks like nothing is selected.
    await expect(more).toHaveClass(/text-foreground/);
  });

  test("carries Search and Sign out, the two actions the bar gave up", async ({
    page,
  }) => {
    await page.goto("/");

    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: /More/ })
      .click();

    const sheet = page.getByRole("navigation", { name: "More" });
    await expect(sheet.getByRole("button", { name: "Search" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Sign out" })).toBeVisible();
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

    test("no floating dock, and the bottom nav still reaches the inbox", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(
        page.getByRole("button", { name: "Capture a thought" })
      ).toHaveCount(0);

      // #114 moved the Inbox tab into the "More" sheet — still one tap from
      // the bar, which is what #85's promise actually requires.
      await page
        .getByRole("navigation", { name: "Primary" })
        .getByRole("button", { name: /More/ })
        .click();

      const inbox = page
        .getByRole("navigation", { name: "More" })
        .getByRole("link", { name: /Inbox/ });
      await expect(inbox).toHaveCount(1);
      await inbox.click();

      await expect(page).toHaveURL(/\/inbox$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Inbox" })
      ).toBeVisible();
    });

    test("the bottom bar fits without horizontal overflow", async ({
      page,
    }) => {
      await page.goto("/");
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

      const nav = page.getByRole("navigation", { name: "Primary" });
      const navBox = await nav.boundingBox();
      expect(navBox).not.toBeNull();
      expect(navBox!.width).toBeLessThanOrEqual(NARROW.width);
      expect(navBox!.height).toBeGreaterThanOrEqual(44);
    });
  });
});
