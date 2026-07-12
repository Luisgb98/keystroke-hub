// Explicit extension: this module is reachable from
// e2e/support/fake-google-server.ts, which plain `node` executes directly —
// its ESM resolver (unlike Playwright's esbuild-based TS transform for spec
// files) requires one.
import { hashPasswordSync } from "../../lib/auth/password.ts";

/**
 * Dedicated e2e credentials — never the real ones. playwright.config.ts
 * injects the derived hash/secret into the app under test's environment,
 * so e2e runs are hermetic and need no local .env.
 */
export const E2E_PASSWORD = "e2e-only-correct-horse";
export const E2E_PASSWORD_HASH = hashPasswordSync(E2E_PASSWORD);
export const E2E_SESSION_SECRET = "e2e-session-secret-0123456789abcdef";

/** Authenticated browser state written by e2e/auth.setup.ts. */
export const STORAGE_STATE = "e2e/.auth/user.json";

// --- Google Calendar sync (issue #12) ---
//
// Real Google OAuth isn't automatable in CI, so e2e specs point the app's
// outbound Google calls at a local fake server instead (see
// e2e/support/fake-google-server.ts and docs/google-sync.md).
export const FAKE_GOOGLE_PORT = 4310;
export const FAKE_GOOGLE_BASE_URL = `http://127.0.0.1:${FAKE_GOOGLE_PORT}`;
export const E2E_GOOGLE_CLIENT_ID = "e2e-fake-client-id";
export const E2E_GOOGLE_CLIENT_SECRET = "e2e-fake-client-secret";
// Fixed (not randomly generated): must be identical in every process that
// touches an e2e-seeded connection row — the Next server (decrypting at
// runtime) and any spec/fixture code (encrypting while seeding) run in
// separate Playwright worker processes and can't share in-memory state.
export const E2E_GOOGLE_TOKEN_ENCRYPTION_KEY =
  "Xxd7oidPxvoey2tpYyV+fGHHcFLVRzFtc2ETs1lD7io=";
export const E2E_CRON_SECRET = "e2e-cron-secret";

// --- GitHub issue linking (issue #27) ---
//
// The metadata fetch happens server-side, so Playwright's page-level route
// interception can't reach it — same rationale as the fake Google server
// above. `GITHUB_API_BASE_URL` points the app under test at
// e2e/support/fake-github-server.ts instead of the real GitHub API.
export const FAKE_GITHUB_PORT = 4311;
export const FAKE_GITHUB_BASE_URL = `http://127.0.0.1:${FAKE_GITHUB_PORT}`;
