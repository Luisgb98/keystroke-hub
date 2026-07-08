import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { like } from "drizzle-orm";

import { ideas } from "../../lib/db/schema";
import type { IdeaFormat } from "../../lib/content/idea-format";
import type { IdeaStatus } from "../../lib/content/idea-status";

function getTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — ideas e2e tests require it.");
  }
  return drizzle(neon(connectionString));
}

/** Removes every fixture row under a given title prefix — mirrors `clearEventsWithPrefix` in `events-db.ts`. */
export async function clearTestIdeas(prefix: string): Promise<void> {
  const db = getTestDb();
  await db.delete(ideas).where(like(ideas.title, `${prefix}%`));
}

/** Inserts a single idea directly, bypassing the capture UI — for specs that need pre-existing rows (filtering, status change, delete). */
export async function seedTestIdea(fixture: {
  title: string;
  notes?: string;
  format?: IdeaFormat;
  status?: IdeaStatus;
  tags?: string[];
}): Promise<void> {
  const db = getTestDb();
  await db.insert(ideas).values({
    title: fixture.title,
    notes: fixture.notes ?? null,
    format: fixture.format ?? "either",
    status: fixture.status ?? "spark",
    tags: fixture.tags ?? [],
  });
}
