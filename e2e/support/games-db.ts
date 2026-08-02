import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, like } from "drizzle-orm";

import { games, ideas, streams } from "../../lib/db/schema";

function getTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — games e2e tests require it.");
  }
  return drizzle(neon(connectionString));
}

/**
 * Removes every fixture game under a given name prefix. Ideas and streams
 * tagged with them are untagged by the `ON DELETE SET NULL` FK, exactly as a
 * real delete would — so cleanup can never take a spec's other fixtures with
 * it (see docs/content-games.md).
 */
export async function clearTestGames(prefix: string): Promise<void> {
  const db = getTestDb();
  await db.delete(games).where(like(games.name, `${prefix}%`));
}

/**
 * Inserts a library entry directly, bypassing the picker — for specs that need
 * one to already exist. Idempotent: `games_name_lower_unique` makes a re-seed
 * (a leftover row from an interrupted run) a conflict rather than a second
 * copy, so the existing id is read back instead of throwing.
 */
export async function seedTestGame(name: string): Promise<string> {
  const db = getTestDb();
  const [row] = await db
    .insert(games)
    .values({ name })
    .onConflictDoNothing()
    .returning({ id: games.id });
  if (row) return row.id;

  const [existing] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.name, name));
  return existing.id;
}

/** Tags an existing idea with a game directly — the setup half of a filter spec. */
export async function setTestIdeaGame(
  title: string,
  gameId: string | null
): Promise<void> {
  const db = getTestDb();
  await db.update(ideas).set({ gameId }).where(eq(ideas.title, title));
}

/**
 * Reads back an idea's persisted game id by exact title — the same
 * "gate on the DB row, not the optimistic UI" precedent as
 * `getTestIdeaStatus` in `ideas-db.ts`.
 */
export async function getTestIdeaGameId(
  title: string
): Promise<string | null | undefined> {
  const db = getTestDb();
  const [row] = await db
    .select({ gameId: ideas.gameId })
    .from(ideas)
    .where(eq(ideas.title, title));
  return row?.gameId;
}

/** The stream-side counterpart of `getTestIdeaGameId`. */
export async function getTestStreamGameId(
  title: string
): Promise<string | null | undefined> {
  const db = getTestDb();
  const [row] = await db
    .select({ gameId: streams.gameId })
    .from(streams)
    .where(eq(streams.title, title));
  return row?.gameId;
}

/** Whether a game name exists in the library — proves a rename landed, or that a duplicate never appeared. */
export async function countTestGames(name: string): Promise<number> {
  const db = getTestDb();
  const rows = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.name, name));
  return rows.length;
}
