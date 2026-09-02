import { expect, test } from "@playwright/test";

import {
  APP_BACKGROUND_DARK,
  APP_BACKGROUND_LIGHT,
  APP_NAME,
} from "../lib/brand";

/**
 * Installability, end to end (#114). None of this needs a database — it's all
 * static metadata — but it does need the real server: the manifest is a route
 * handler and the meta tags are emitted by the root layout.
 */
test.describe("PWA installability", () => {
  test("the document links the manifest and the Apple touch icon", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      /manifest\.webmanifest/
    );
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      "/apple-touch-icon.png"
    );
  });

  test("iOS is told the app is standalone-capable, under its own name", async ({
    page,
  }) => {
    await page.goto("/");

    // Next 16 emits the standardised `mobile-web-app-capable` for
    // `appleWebApp.capable`, not the legacy `apple-` prefixed name; iOS has
    // honoured the unprefixed one since Safari 15.4.
    await expect(
      page.locator('meta[name="mobile-web-app-capable"]')
    ).toHaveAttribute("content", "yes");
    await expect(
      page.locator('meta[name="apple-mobile-web-app-title"]')
    ).toHaveAttribute("content", APP_NAME);
    await expect(
      page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')
    ).toHaveAttribute("content", "default");
  });

  test("the viewport opts into the display cutout, so safe-area insets resolve", async ({
    page,
  }) => {
    await page.goto("/");

    // Without `viewport-fit=cover` every `env(safe-area-inset-*)` in the app
    // is 0 on a notched iPhone — including the bottom nav's own padding.
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      /viewport-fit=cover/
    );
  });

  test("the browser chrome is tinted per color scheme", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.locator('meta[name="theme-color"][media*="light"]')
    ).toHaveAttribute("content", APP_BACKGROUND_LIGHT);
    await expect(
      page.locator('meta[name="theme-color"][media*="dark"]')
    ).toHaveAttribute("content", APP_BACKGROUND_DARK);
  });
});

test.describe("PWA installability — signed out", () => {
  // Browsers fetch the manifest and its icons *without* credentials, so if the
  // session gate covered them the app would simply never be installable. This
  // starts from a blank slate to prove it doesn't (same idiom as auth.spec.ts).
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the manifest is served without a session and passes the install bar", async ({
    request,
  }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toBe(APP_NAME);
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");

    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  test("every icon the manifest names is fetchable without a session", async ({
    request,
  }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();

    for (const icon of manifest.icons as { src: string }[]) {
      const response = await request.get(icon.src);
      expect(response.status(), icon.src).toBe(200);
      expect(response.headers()["content-type"], icon.src).toContain(
        "image/png"
      );
    }

    const apple = await request.get("/apple-touch-icon.png");
    expect(apple.status()).toBe(200);
  });
});
