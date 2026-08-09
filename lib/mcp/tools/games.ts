import "server-only";

import { z } from "zod";

import {
  createGameCore,
  deleteGameCore,
  renameGameCore,
} from "@/lib/content/core/games";
import { getGameUsage, getGamesWithUsage } from "@/lib/data/games";

import { idParam } from "../params";
import {
  defineTool,
  fromCoreResult,
  ok,
  type McpToolDefinition,
} from "../tool";

/** Game-library tools (issue #105's library, driven from MCP by #109). */

const listGames = defineTool(
  "list_games",
  {
    title: "List the game library",
    description:
      "Every game in the library, alphabetically, with how many ideas and streams are tagged with each. Ideas and streams reference a game by id, so read this before tagging anything.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  },
  async () => {
    const games = await getGamesWithUsage();
    return ok({
      count: games.length,
      games: games.map((game) => ({
        id: game.id,
        name: game.name,
        ideaCount: game.ideaCount,
        streamCount: game.streamCount,
      })),
    });
  }
);

const createGame = defineTool(
  "create_game",
  {
    title: "Add a game to the library",
    description:
      "Adds a game, or hands back the existing entry when one already matches. Matching ignores case and collapses whitespace, exactly as the picker does — 'PoE  League' against an existing 'poe league' selects that entry rather than creating a second copy.",
    inputSchema: z.object({ name: z.string() }),
    annotations: { idempotentHint: true },
  },
  async ({ name }) => {
    const result = await createGameCore(name);
    return fromCoreResult(result, {
      game: result.game ? { id: result.game.id, name: result.game.name } : null,
    });
  }
);

const renameGame = defineTool(
  "rename_game",
  {
    title: "Rename a game",
    description:
      "Renames a library entry. Every idea and stream tagged with it follows automatically — they point at the id, not the name. Renaming onto a name another entry already holds is refused rather than merging the two.",
    inputSchema: z.object({ gameId: idParam, name: z.string() }),
  },
  async ({ gameId, name }) => {
    const result = await renameGameCore(gameId, name);
    return fromCoreResult(result, {
      game: result.game ? { id: result.game.id, name: result.game.name } : null,
    });
  }
);

const deleteGame = defineTool(
  "delete_game",
  {
    title: "Delete a game",
    description:
      "Removes a library entry. Ideas and streams tagged with it are UNTAGGED, never deleted. Call with `confirm: false` (the default) first to see exactly how much work is about to lose its tag, then repeat with `confirm: true` to go through with it. There is no undo for the entry itself.",
    inputSchema: z.object({
      gameId: idParam,
      confirm: z
        .boolean()
        .optional()
        .describe(
          "Leave unset to preview the usage without deleting. Set true to delete."
        ),
    }),
    annotations: { destructiveHint: true },
  },
  async ({ gameId, confirm }) => {
    const usage = await getGameUsage(gameId);
    if (!confirm) {
      return ok({
        gameId,
        deleted: false,
        usage,
        message: `Deleting this game would untag ${usage.ideaCount} idea(s) and ${usage.streamCount} stream(s). Call again with confirm: true to proceed.`,
      });
    }

    const result = await deleteGameCore(gameId);
    return fromCoreResult(result, { gameId, deleted: true, untagged: usage });
  }
);

export const gameTools: McpToolDefinition[] = [
  listGames,
  createGame,
  renameGame,
  deleteGame,
];
