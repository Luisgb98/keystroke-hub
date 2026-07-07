import { hashPasswordSync } from "../../lib/auth/password";

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
