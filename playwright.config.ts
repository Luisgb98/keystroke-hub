import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

import {
  E2E_CRON_SECRET,
  E2E_GOOGLE_CLIENT_ID,
  E2E_GOOGLE_CLIENT_SECRET,
  E2E_GOOGLE_TOKEN_ENCRYPTION_KEY,
  E2E_PASSWORD_HASH,
  E2E_SESSION_SECRET,
  FAKE_GITHUB_BASE_URL,
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
      // content-links.spec.ts, streams.spec.ts, publish-checklist.spec.ts,
      // journal.spec.ts, weekly-summary.spec.ts, weekly-assessment.spec.ts,
      // projects.spec.ts, improvements.spec.ts, meetings.spec.ts,
      // github-links.spec.ts, dashboard.spec.ts, mobile.spec.ts (whose
      // journal and weekly-summary cases write real rows), and
      // command-palette.spec.ts (whose content-search describe seeds/clears
      // a real project + idea) and ideas.spec.ts (capture/filters/release
      // seed/create/clear real rows) and idea-detail.spec.ts (seeds ideas and
      // writes scripts, with its own mobile-viewport check) seed/create/clear
      // real rows (calendar-sync.spec.ts's connection rows are also
      // unique-per-track) in the dev database and already cover their own
      // mobile-viewport checks via `test.use`, so running them again under this
      // project would race against the chromium project's runs against the same
      // shared DB.
      testIgnore:
        /(calendar|calendar-sync|event-management|drag-reschedule|agenda|board|scripts|content-links|streams|publish-checklist|journal|weekly-summary|weekly-assessment|projects|improvements|meetings|github-links|dashboard|mobile|command-palette|inbox|ideas|idea-detail)\.spec\.ts$/,
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
      // Stands in for the GitHub REST issues endpoint (issue #27) — same
      // rationale as the fake Google server above (see
      // e2e/support/fake-github-server.ts).
      command: "node e2e/support/fake-github-server.ts",
      url: `${FAKE_GITHUB_BASE_URL}/__control/health`,
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
        GITHUB_API_BASE_URL: FAKE_GITHUB_BASE_URL,
      },
    },
  ],
});
