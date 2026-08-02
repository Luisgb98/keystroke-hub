import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, like } from "drizzle-orm";

import { events, ideas } from "../../lib/db/schema";
import { releaseEventTitle } from "../../lib/content/release";
import type { IdeaFormat } from "../../lib/content/idea-format";
import type { IdeaStatus } from "../../lib/content/idea-status";

function getTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — ideas e2e tests require it.");
  }
  return drizzle(neon(connectionString));
}

/**
 * Removes every fixture row under a given title prefix — mirrors
 * `clearEventsWithPrefix` in `events-db.ts`. An idea's managed release event
 * (#71) is a separate `events` row (`Release: <title>`), not reached by a
 * direct idea delete, so it's cleared here too.
 */
export async function clearTestIdeas(prefix: string): Promise<void> {
  const db = getTestDb();
  await db
    .delete(events)
    .where(like(events.title, `${releaseEventTitle(prefix)}%`));
  await db.delete(ideas).where(like(ideas.title, `${prefix}%`));
}

/**
 * Reads back an idea's persisted status by exact title — mirrors
 * `getTestEventTimes` in `events-db.ts`.
 *
 * Needed because both status surfaces are optimistic (`PipelineBoard`,
 * `IdeaStatusSelect`): the UI shows the new stage the instant it's picked, so a
 * spec that reloads to prove persistence would otherwise be racing the write it
 * never waited for.
 */
export async function getTestIdeaStatus(
  title: string
): Promise<string | undefined> {
  const db = getTestDb();
  const [row] = await db
    .select({ status: ideas.status })
    .from(ideas)
    .where(eq(ideas.title, title));
  return row?.status;
}

/** Inserts a single idea directly, bypassing the capture UI — for specs that need pre-existing rows (filtering, status change, delete). */
export async function seedTestIdea(fixture: {
  title: string;
  description?: string;
  format?: IdeaFormat;
  status?: IdeaStatus;
  tags?: string[];
  /** Overrides the default-now `stage_entered_at` — for dashboard specs that need a deterministic "stuck longest" pick regardless of other rows in the dev DB. */
  stageEnteredAt?: Date;
}): Promise<void> {
  const db = getTestDb();
  await db.insert(ideas).values({
    title: fixture.title,
    description: fixture.description ?? null,
    format: fixture.format ?? "either",
    status: fixture.status ?? "idea",
    tags: fixture.tags ?? [],
    ...(fixture.stageEnteredAt
      ? { stageEnteredAt: fixture.stageEnteredAt }
      : {}),
  });
}
