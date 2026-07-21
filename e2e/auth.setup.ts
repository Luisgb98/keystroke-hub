import { expect, test as setup } from "@playwright/test";

import { E2E_PASSWORD, STORAGE_STATE } from "./support/credentials";

// Signs in once through the real login flow and saves the browser state;
// every other e2e project starts from it (see playwright.config.ts).
setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);
  await page.context().storageState({ path: STORAGE_STATE });
});
