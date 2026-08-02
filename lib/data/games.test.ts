// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => {
  const selectQueue: unknown[][] = [];
  function next(): Promise<unknown[]> {
    return Promise.resolve(selectQueue.shift() ?? []);
  }
  // Awaitable at any link: `getGames` ends on `.orderBy()`, `resolveGameId`
  // on `.where()` (mirrors the chain mock in `lib/content/stream-actions.test.ts`).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeChain(): any {
    const chain = {
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
        next().then(resolve, reject),
    };
    return chain;
  }
  return {
    selectQueue,
    select: vi.fn(() => ({ from: vi.fn(() => makeChain()) })),
  };
});

vi.mock("@/lib/db", () => ({ getDb: () => dbMock }));

import {
  getGamesById,
  getGamesWithUsage,
  getGameUsage,
  resolveGameId,
} from "./games";

const POE = {
  id: "game-poe",
  name: "Path of Exile",
  createdAt: new Date(),
  updatedAt: new Date(),
};
const HADES = {
  id: "game-hades",
  name: "Hades",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  dbMock.selectQueue.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getGamesById", () => {
  it("keys the library by id, which is what every game chip looks up", async () => {
    dbMock.selectQueue.push([POE, HADES]);
    const byId = await getGamesById();

    expect(byId.get("game-poe")?.name).toBe("Path of Exile");
    expect(byId.get("game-hades")?.name).toBe("Hades");
    expect(byId.size).toBe(2);
  });

  it("is empty rather than undefined for an empty library", async () => {
    dbMock.selectQueue.push([]);
    await expect(getGamesById()).resolves.toEqual(new Map());
  });
});

describe("getGamesWithUsage", () => {
  it("coerces the bigint counts the driver hands back as strings", async () => {
    dbMock.selectQueue.push([
      { ...POE, ideaCount: "3", streamCount: "1" },
      { ...HADES, ideaCount: "0", streamCount: "0" },
    ]);

    const rows = await getGamesWithUsage();

    expect(rows[0].ideaCount).toBe(3);
    expect(rows[0].streamCount).toBe(1);
    // A game nothing is tagged with still comes back — it just reads as unused.
    expect(rows[1]).toMatchObject({ ideaCount: 0, streamCount: 0 });
  });
});

describe("getGameUsage", () => {
  it("counts both sides of what a delete would untag", async () => {
    dbMock.selectQueue.push([{ id: "i-1" }, { id: "i-2" }]);
    dbMock.selectQueue.push([{ id: "s-1" }]);

    await expect(getGameUsage("game-poe")).resolves.toEqual({
      ideaCount: 2,
      streamCount: 1,
    });
  });
});

describe("resolveGameId", () => {
  it("passes through an id that really exists", async () => {
    dbMock.selectQueue.push([{ id: "game-poe" }]);
    await expect(resolveGameId("game-poe")).resolves.toBe("game-poe");
  });

  it("degrades a stale id to 'no game' rather than a foreign-key violation", async () => {
    dbMock.selectQueue.push([]);
    await expect(resolveGameId("game-deleted")).resolves.toBeNull();
  });

  it("short-circuits on null without querying", async () => {
    await expect(resolveGameId(null)).resolves.toBeNull();
    expect(dbMock.select).not.toHaveBeenCalled();
  });
});
