"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { games, type Game } from "@/lib/db/schema";
import {
  getGameUsage as getGameUsageQuery,
  type GameUsage,
} from "@/lib/data/games";

import {
  gameCreateSchema,
  gameIdSchema,
  gameRenameSchema,
} from "./game-schema";

/**
 * The library and every game chip live under `/content` — the ideas list, the
 * board, the streams list, and both detail routes. A rename has to reach all
 * of them (that's the whole point of a normalized library), so these mutations
 * revalidate the subtree rather than enumerating routes and forgetting one.
 */
function revalidateGamePaths(): void {
  revalidatePath("/content", "layout");
}

export interface GameMutationResult {
  error?: string;
  game?: Game;
}

/** Case-insensitive lookup against the same `lower(name)` the unique index uses. */
async function findByName(name: string): Promise<Game | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(games)
    .where(sql`lower(${games.name}) = lower(${name})`);
  return row;
}

/**
 * Adds a game to the library, or hands back the one that's already there.
 *
 * Adding a duplicate is a *success* returning the existing row, not an error:
 * the picker calls this the moment you type a name it doesn't recognise, and
 * "PoE league" typed against an existing "poe league" should just select that
 * entry (see docs/content-games.md). The `games_name_lower_unique` index is
 * the real guarantee — the lookup below is the friendly path, and the
 * `onConflictDoNothing` + re-read handles the race where two requests both
 * found nothing.
 */
export async function createGame(name: string): Promise<GameMutationResult> {
  await verifySession();

  const parsed = gameCreateSchema.safeParse({ name });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "That name isn't valid.",
    };
  }

  const existing = await findByName(parsed.data.name);
  if (existing) return { game: existing };

  const db = getDb();
  const [inserted] = await db
    .insert(games)
    .values({ name: parsed.data.name })
    .onConflictDoNothing()
    .returning();

  const game = inserted ?? (await findByName(parsed.data.name));
  if (!game) {
    return { error: "That game couldn't be added. Try again." };
  }

  revalidateGamePaths();
  return { game };
}

/**
 * Renames a library entry. Nothing else has to change: ideas and streams point
 * at the game by id, so every place the old spelling showed is reading this
 * one row — which is exactly why the game is a table and not another tag.
 *
 * Renaming into a name another entry already holds is rejected rather than
 * silently merging the two: merging would retag work the user never asked to
 * move. Renaming an entry to its own name in different casing is allowed —
 * that's a correction, not a collision.
 */
export async function renameGame(
  id: string,
  name: string
): Promise<GameMutationResult> {
  await verifySession();

  const parsed = gameRenameSchema.safeParse({ id, name });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "That name isn't valid.",
    };
  }

  const clash = await findByName(parsed.data.name);
  if (clash && clash.id !== parsed.data.id) {
    return { error: `"${clash.name}" is already in your library.` };
  }

  const db = getDb();
  const [updated] = await db
    .update(games)
    .set({ name: parsed.data.name })
    .where(eq(games.id, parsed.data.id))
    .returning();

  if (!updated) {
    return { error: "That game no longer exists." };
  }

  revalidateGamePaths();
  return { game: updated };
}

export interface DeleteGameResult {
  error?: string;
}

/**
 * Removes a library entry. Ideas and streams tagged with it are *untagged*,
 * never deleted and never left pointing at nothing — that's the
 * `ON DELETE SET NULL` on both `game_id` columns doing the work (see
 * lib/db/schema.ts). The caller is expected to have shown what's in use first
 * via `getGameUsage`.
 */
export async function deleteGame(id: string): Promise<DeleteGameResult> {
  await verifySession();

  const parsed = gameIdSchema.safeParse(id);
  if (!parsed.success) {
    return { error: "That game no longer exists." };
  }

  const db = getDb();
  const deleted = await db
    .delete(games)
    .where(eq(games.id, parsed.data))
    .returning({ id: games.id });

  if (deleted.length === 0) {
    return { error: "That game no longer exists." };
  }

  revalidateGamePaths();
  return {};
}

/**
 * Backs the delete confirmation: a direct client -> server-action call, since
 * `lib/data/games.ts` is `server-only` and can't be imported into a Client
 * Component (same pattern as `searchAttachableEvents`).
 */
export async function getGameUsage(id: string): Promise<GameUsage> {
  await verifySession();
  const parsed = gameIdSchema.safeParse(id);
  if (!parsed.success) return { ideaCount: 0, streamCount: 0 };
  return getGameUsageQuery(parsed.data);
}
