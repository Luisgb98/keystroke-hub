"use server";

import { verifySession } from "@/lib/auth/session";
import {
  getGameUsage as getGameUsageQuery,
  type GameUsage,
} from "@/lib/data/games";

import {
  createGameCore,
  deleteGameCore,
  renameGameCore,
  type DeleteGameResult,
  type GameMutationResult,
} from "./core/games";
import { gameIdSchema } from "./game-schema";

/** Session gates over `lib/content/core/games.ts`, which the MCP game tools share (see docs/mcp.md). */

/**
 * NOTE: a `"use server"` module must not re-export its types. Next's Server
 * Actions transform turns every export into a runtime action reference, and a
 * type-only re-export becomes a `ReferenceError` at module evaluation. Callers
 * that need these shapes import them from the core module directly (a plain
 * `import type`, fully erased, so `server-only` never reaches the client).
 */

export async function createGame(name: string): Promise<GameMutationResult> {
  await verifySession();
  return createGameCore(name);
}

export async function renameGame(
  id: string,
  name: string
): Promise<GameMutationResult> {
  await verifySession();
  return renameGameCore(id, name);
}

export async function deleteGame(id: string): Promise<DeleteGameResult> {
  await verifySession();
  return deleteGameCore(id);
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
