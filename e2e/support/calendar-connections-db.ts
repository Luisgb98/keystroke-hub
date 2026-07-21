import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { like } from "drizzle-orm";

import type { Track } from "../../lib/calendar/types";
import { calendarConnections } from "../../lib/db/schema";
import { E2E_GOOGLE_TOKEN_ENCRYPTION_KEY } from "./credentials";

// Must be set before `encryptToken` is first called below — the app's
// runtime process gets this from playwright.config.ts's webServer env, but
// spec files run in a separate worker process, so it's set explicitly here.
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = E2E_GOOGLE_TOKEN_ENCRYPTION_KEY;

import { encryptToken } from "../../lib/google/crypto";

export const E2E_CONNECTION_EMAIL = "e2e-owner@example.com";

function getTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — calendar-sync e2e tests require it."
    );
  }
  return drizzle(neon(connectionString));
}

/**
 * Seeds a `calendar_connections` row directly, bypassing the real Google
 * OAuth consent redirect — not automatable in e2e (docs/google-sync.md).
 * The app's outbound calls for this connection are faked at the HTTP
 * boundary by e2e/support/fake-google-server.ts, not by this fixture.
 */
export async function seedConnection(track: Track) {
  const db = getTestDb();
  const [row] = await db
    .insert(calendarConnections)
    .values({
      track,
      googleAccountEmail: E2E_CONNECTION_EMAIL,
      googleCalendarId: "primary",
      accessTokenEncrypted: encryptToken("fake-access-token"),
      refreshTokenEncrypted: encryptToken("fake-refresh-token"),
      tokenExpiresAt: new Date(Date.now() + 3600_000),
      status: "active",
    })
    .returning();
  return row;
}

/** Removes every connection this suite may have seeded. */
export async function clearConnections(): Promise<void> {
  const db = getTestDb();
  await db
    .delete(calendarConnections)
    .where(like(calendarConnections.googleAccountEmail, "e2e-%"));
}
