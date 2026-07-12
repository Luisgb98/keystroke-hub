import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { like } from "drizzle-orm";

import { ideas, projects } from "../../lib/db/schema";

function getTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — projects e2e tests require it.");
  }
  return drizzle(neon(connectionString));
}

/** Removes every fixture project under a given name prefix — mirrors `clearTestStreams` in `streams-db.ts`. */
export async function clearTestProjects(prefix: string): Promise<void> {
  const db = getTestDb();
  await db.delete(projects).where(like(projects.name, `${prefix}%`));
}

/** Removes every fixture idea under a given title prefix — used by specs that seed ideas to link, mirrors `clearTestIdeas`. */
export async function clearTestIdeas(prefix: string): Promise<void> {
  const db = getTestDb();
  await db.delete(ideas).where(like(ideas.title, `${prefix}%`));
}

/** Inserts a single unassigned idea directly, bypassing capture — for the idea-attach picker specs. */
export async function seedTestIdea(title: string): Promise<void> {
  const db = getTestDb();
  await db.insert(ideas).values({ title });
}
