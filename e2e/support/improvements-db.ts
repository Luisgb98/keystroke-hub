import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { like } from "drizzle-orm";

import { improvements } from "../../lib/db/schema";

function getTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — improvements e2e tests require it."
    );
  }
  return drizzle(neon(connectionString));
}

/** Removes every fixture improvement under a given title prefix — mirrors `clearTestProjects` in `projects-db.ts`. */
export async function clearTestImprovements(prefix: string): Promise<void> {
  const db = getTestDb();
  await db.delete(improvements).where(like(improvements.title, `${prefix}%`));
}
