import { expect, test } from "@playwright/test";

import { E2E_PASSWORD } from "./support/credentials";

test.describe("access gate — signed out", () => {
  // Start from a blank slate instead of the shared authenticated state.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the app root redirects to the login screen", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("a deep link redirects to login and is restored after signing in", async ({
    page,
  }) => {
    await page.goto("/journal");
    await expect(page).toHaveURL(/\/login\?from=%2Fjournal$/);

    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/journal$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Journal" })
    ).toBeVisible();
  });

  test("a wrong password shows a generic error and stays on the login screen", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Password").fill("definitely-not-it");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Scoped to the form — Next's route announcer is also role="alert".
    await expect(page.locator("form").getByRole("alert")).toHaveText(
      "That password isn't right."
    );
    await expect(page).toHaveURL(/\/login$/);

    // Still recoverable: the right password works from the error state.
    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the styleguide is gated too", async ({ page }) => {
    await page.goto("/styleguide");
    await expect(page).toHaveURL(/\/login\?from=%2Fstyleguide$/);
  });

  test("unknown API routes answer 401 instead of redirecting", async ({
    request,
  }) => {
    const response = await request.get("/api/anything");
    expect(response.status()).toBe(401);
  });

  test("the health probe stays public", async ({ request }) => {
    // 200 with a database configured, 503 without — never the gate's 401.
    const response = await request.get("/api/health", { timeout: 15_000 });
    expect([200, 503]).toContain(response.status());
  });
});

test.describe("access gate — signed in", () => {
  test("the session persists across a reload", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeVisible();
  });

  test("visiting /login while signed in bounces back home", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeVisible();
  });

  test("signing out returns to login and locks the app again", async ({
    page,
  }) => {
    await page.goto("/");

    // Sidebar icon button on desktop, bottom-bar action on mobile.
    await page
      .getByRole("button", { name: "Sign out" })
      .filter({ visible: true })
      .click();

    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/journal");
    await expect(page).toHaveURL(/\/login\?from=%2Fjournal$/);
  });
});
