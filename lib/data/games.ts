import "server-only";
import { asc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { games, ideas, streams, type Game } from "@/lib/db/schema";

/** A game plus how much work is tagged with it — what the library page lists. */
export interface GameWithUsage extends Game {
  ideaCount: number;
  streamCount: number;
}

/** Just enough of a game to render a chip or fill the picker (see docs/content-games.md). */
export interface GameOption {
  id: string;
  name: string;
}

/**
 * Every game, alphabetically. Single-user app with a hand-curated library, so
 * this is deliberately unpaginated — the picker filters the whole list in the
 * browser rather than round-tripping per keystroke.
 *
 * Sorted case-insensitively so "PoE" and "path of exile" interleave the way a
 * reader expects, rather than by Postgres' default byte order.
 */
export async function getGames(): Promise<Game[]> {
  const db = getDb();
  return db
    .select()
    .from(games)
    .orderBy(asc(sql`lower(${games.name})`));
}

/**
 * The same list keyed by id — every surface that renders a game chip
 * (idea cards, the ideas list, detail pages) needs the *name* behind a row's
 * `gameId`, and one query for the whole library beats a join per surface.
 */
export async function getGamesById(): Promise<Map<string, Game>> {
  const rows = await getGames();
  return new Map(rows.map((game) => [game.id, game]));
}

/**
 * Games with their idea/stream counts, for the library page. Correlated
 * subqueries rather than two `GROUP BY` joins: a game with no ideas but two
 * streams still has to come back with `0`/`2`, which an inner join would drop
 * and a double left join would double-count.
 */
export async function getGamesWithUsage(): Promise<GameWithUsage[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: games.id,
      name: games.name,
      createdAt: games.createdAt,
      updatedAt: games.updatedAt,
      ideaCount: sql<number>`(select count(*) from ${ideas} where ${ideas.gameId} = ${games.id})`,
      streamCount: sql<number>`(select count(*) from ${streams} where ${streams.gameId} = ${games.id})`,
    })
    .from(games)
    .orderBy(asc(sql`lower(${games.name})`));

  // `count(*)` comes back as a bigint, which the driver hands over as a
  // string — coerce here so callers can render and compare plain numbers.
  return rows.map((row) => ({
    ...row,
    ideaCount: Number(row.ideaCount),
    streamCount: Number(row.streamCount),
  }));
}

/**
 * Narrows a client-supplied `gameId` to one that really exists, or `null`.
 *
 * Every form that carries the field runs through this: a stale id (the game
 * was deleted in another tab while the dialog sat open) must degrade to "no
 * game" rather than failing the whole save with a foreign-key violation, and
 * re-reading from a trusted source is what the server-actions data-security
 * guide asks for anyway.
 */
export async function resolveGameId(
  gameId: string | null
): Promise<string | null> {
  if (!gameId) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.id, gameId));
  return row?.id ?? null;
}

export interface GameUsage {
  ideaCount: number;
  streamCount: number;
}

/**
 * How many ideas and streams a single game is tagged on — read *before* a
 * delete so the confirmation can say what's about to be untagged rather than
 * asking blind (see docs/content-games.md).
 */
export async function getGameUsage(id: string): Promise<GameUsage> {
  const db = getDb();
  const [ideaRows, streamRows] = await Promise.all([
    db.select({ id: ideas.id }).from(ideas).where(eq(ideas.gameId, id)),
    db.select({ id: streams.id }).from(streams).where(eq(streams.gameId, id)),
  ]);
  return { ideaCount: ideaRows.length, streamCount: streamRows.length };
}
