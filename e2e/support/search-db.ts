import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { projects } from "../../lib/db/schema";

function getTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — command palette e2e tests require it."
    );
  }
  return drizzle(neon(connectionString));
}

/** Inserts a single project directly, bypassing the capture UI — mirrors `seedTestIdea` in `ideas-db.ts`. */
export async function seedTestProject(name: string): Promise<void> {
  const db = getTestDb();
  await db.insert(projects).values({ name });
}
