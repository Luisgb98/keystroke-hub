import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

import {
  E2E_CRON_SECRET,
  E2E_GOOGLE_CLIENT_ID,
  E2E_GOOGLE_CLIENT_SECRET,
  E2E_GOOGLE_TOKEN_ENCRYPTION_KEY,
  E2E_PASSWORD_HASH,
  E2E_SESSION_SECRET,
  FAKE_GOOGLE_BASE_URL,
  STORAGE_STATE,
} from "./e2e/support/credentials";

// The Playwright test runner is a plain Node process — unlike `next dev`/
// `next start`, it doesn't load `.env*` files on its own. Loading it here
// makes `process.env.DATABASE_URL` available both to spec files (e.g. the
// health and calendar DB-skip checks) and to the webServer env below.
config({ path: ".env.local" });
config({ path: ".env" });

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
      // calendar.spec.ts, event-management.spec.ts, calendar-sync.spec.ts,
      // drag-reschedule.spec.ts, agenda.spec.ts, board.spec.ts, scripts.spec.ts,
      // content-links.spec.ts, streams.spec.ts, and publish-checklist.spec.ts
      // seed/create/clear real rows (calendar-sync.spec.ts's connection rows
      // are also unique-per-track) in the dev database and already cover
      // their own mobile-viewport checks via `test.use`, so running them
      // again under this project would race against the chromium project's
      // runs against the same shared DB.
      testIgnore:
        /(calendar|calendar-sync|event-management|drag-reschedule|agenda|board|scripts|content-links|streams|publish-checklist)\.spec\.ts$/,
    },
  ],
  webServer: [
    {
      // Stands in for Google's OAuth token + Calendar REST endpoints (issue
      // #12) — real Google OAuth isn't automatable in CI, and the app's
      // Google calls all happen server-side, so page-level route
      // interception can't reach them (see e2e/support/fake-google-server.ts).
      command: "node e2e/support/fake-google-server.ts",
      url: `${FAKE_GOOGLE_BASE_URL}/__control/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
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
        GOOGLE_CLIENT_ID: E2E_GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: E2E_GOOGLE_CLIENT_SECRET,
        GOOGLE_TOKEN_ENCRYPTION_KEY: E2E_GOOGLE_TOKEN_ENCRYPTION_KEY,
        GOOGLE_CALENDAR_API_BASE_URL: FAKE_GOOGLE_BASE_URL,
        GOOGLE_OAUTH_TOKEN_BASE_URL: FAKE_GOOGLE_BASE_URL,
        CRON_SECRET: E2E_CRON_SECRET,
      },
    },
  ],
});
