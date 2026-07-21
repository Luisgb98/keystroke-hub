import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { like } from "drizzle-orm";

import { meetingNotes } from "../../lib/db/schema";

function getTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — meeting notes e2e tests require it."
    );
  }
  return drizzle(neon(connectionString));
}

/** Removes every fixture meeting note under a given title prefix — mirrors `clearTestImprovements` in `improvements-db.ts`. */
export async function clearTestMeetingNotes(prefix: string): Promise<void> {
  const db = getTestDb();
  await db.delete(meetingNotes).where(like(meetingNotes.title, `${prefix}%`));
}
