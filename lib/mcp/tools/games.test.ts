// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/content/core/games", () => ({
  createGameCore: vi.fn(),
  renameGameCore: vi.fn(),
  deleteGameCore: vi.fn(),
}));
vi.mock("@/lib/data/games", () => ({
  getGamesWithUsage: vi.fn(),
  getGameUsage: vi.fn(),
}));

import {
  createGameCore,
  deleteGameCore,
  renameGameCore,
} from "@/lib/content/core/games";
import { getGameUsage, getGamesWithUsage } from "@/lib/data/games";

import { gameTools } from "./games";
import { callTool, payloadOf } from "./test-support";

const GAME = {
  id: "game-1",
  name: "Path of Exile 2",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getGameUsage).mockResolvedValue({ ideaCount: 0, streamCount: 0 });
});

describe("list_games", () => {
  it("returns the library with its usage counts", async () => {
    vi.mocked(getGamesWithUsage).mockResolvedValue([
      { ...GAME, ideaCount: 3, streamCount: 1 },
    ]);
    const body = payloadOf(await callTool(gameTools, "list_games"));
    expect(body).toEqual({
      count: 1,
      games: [
        { id: "game-1", name: "Path of Exile 2", ideaCount: 3, streamCount: 1 },
      ],
    });
  });
});

describe("create_game", () => {
  // The same case/whitespace dedupe the picker has — the domain owns it, so
  // the tool must hand back the existing row rather than reporting an error.
  it("returns the existing entry when the name already matches", async () => {
    vi.mocked(createGameCore).mockResolvedValue({ game: GAME });
    const result = await callTool(gameTools, "create_game", {
      name: "  path of  exile 2 ",
    });
    expect(result.isError).toBeUndefined();
    expect(payloadOf(result)).toEqual({
      game: { id: "game-1", name: "Path of Exile 2" },
    });
  });

  it("rejects an empty name", async () => {
    vi.mocked(createGameCore).mockResolvedValue({ error: "Name is required" });
    const result = await callTool(gameTools, "create_game", { name: "   " });
    expect(result.isError).toBe(true);
    expect(payloadOf(result).message).toBe("Name is required");
  });
});

describe("rename_game", () => {
  it("renames the entry", async () => {
    vi.mocked(renameGameCore).mockResolvedValue({
      game: { ...GAME, name: "PoE 2" },
    });
    const body = payloadOf(
      await callTool(gameTools, "rename_game", {
        gameId: "game-1",
        name: "PoE 2",
      })
    );
    expect(body.game).toEqual({ id: "game-1", name: "PoE 2" });
  });

  it("refuses a name another entry already holds rather than merging", async () => {
    vi.mocked(renameGameCore).mockResolvedValue({
      error: '"Elden Ring" is already in your library.',
    });
    const result = await callTool(gameTools, "rename_game", {
      gameId: "game-1",
      name: "Elden Ring",
    });
    expect(result.isError).toBe(true);
  });
});

describe("delete_game", () => {
  // Deleting untags rather than orphaning — the preview is how a client can
  // tell the user what's about to lose its tag before committing.
  it("previews the usage and deletes nothing without confirmation", async () => {
    vi.mocked(getGameUsage).mockResolvedValue({ ideaCount: 4, streamCount: 2 });
    const body = payloadOf(
      await callTool(gameTools, "delete_game", { gameId: "game-1" })
    );
    expect(body).toMatchObject({
      deleted: false,
      usage: { ideaCount: 4, streamCount: 2 },
    });
    expect(deleteGameCore).not.toHaveBeenCalled();
  });

  it("deletes and reports what was untagged once confirmed", async () => {
    vi.mocked(getGameUsage).mockResolvedValue({ ideaCount: 4, streamCount: 2 });
    vi.mocked(deleteGameCore).mockResolvedValue({});
    const body = payloadOf(
      await callTool(gameTools, "delete_game", {
        gameId: "game-1",
        confirm: true,
      })
    );
    expect(deleteGameCore).toHaveBeenCalledWith("game-1");
    expect(body).toEqual({
      gameId: "game-1",
      deleted: true,
      untagged: { ideaCount: 4, streamCount: 2 },
    });
  });

  it("fails on a game that's already gone", async () => {
    vi.mocked(deleteGameCore).mockResolvedValue({
      error: "That game no longer exists.",
    });
    const result = await callTool(gameTools, "delete_game", {
      gameId: "gone",
      confirm: true,
    });
    expect(result.isError).toBe(true);
  });
});
