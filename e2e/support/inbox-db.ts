import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { like } from "drizzle-orm";

import { inboxEntries } from "../../lib/db/schema";

function getTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — inbox e2e tests require it.");
  }
  return drizzle(neon(connectionString));
}

/** Removes every fixture inbox entry under a given body prefix — mirrors `clearTestImprovements` in `improvements-db.ts`. */
export async function clearTestInboxEntries(prefix: string): Promise<void> {
  const db = getTestDb();
  await db.delete(inboxEntries).where(like(inboxEntries.body, `${prefix}%`));
}
