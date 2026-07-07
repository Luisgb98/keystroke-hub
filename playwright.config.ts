import { defineConfig, devices } from "@playwright/test";

import {
  E2E_PASSWORD_HASH,
  E2E_SESSION_SECRET,
  STORAGE_STATE,
} from "./e2e/support/credentials";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      // Hermetic test credentials (see e2e/support/credentials.ts) — the
      // real values from .env are deliberately overridden.
      SESSION_SECRET: E2E_SESSION_SECRET,
      AUTH_PASSWORD_HASH: E2E_PASSWORD_HASH,
    },
  },
});
