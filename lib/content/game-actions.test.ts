// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ verifySession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const dbMock = vi.hoisted(() => {
  // Same FIFO-queue chain as `lib/content/stream-actions.test.ts`: a
  // `select().from().where()` is awaitable at any link, so results are served
  // in call order regardless of chain shape.
  const selectQueue: unknown[][] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeSelectChain(): any {
    const chain = {
      where: vi.fn(() => chain),
      then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
        Promise.resolve(selectQueue.shift() ?? []).then(resolve, reject),
    };
    return chain;
  }

  const insertValues = vi.fn();
  const insertReturning = vi.fn();
  const updateSet = vi.fn();
  const updateReturning = vi.fn();
  const deleteReturning = vi.fn();

  return {
    selectQueue,
    insertValues,
    insertReturning,
    updateSet,
    updateReturning,
    deleteReturning,
    select: vi.fn(() => ({ from: vi.fn(() => makeSelectChain()) })),
    insert: vi.fn(() => ({
      values: vi.fn((values) => {
        insertValues(values);
        return { onConflictDoNothing: () => ({ returning: insertReturning }) };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values) => {
        updateSet(values);
        return { where: vi.fn(() => ({ returning: updateReturning })) };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({ returning: deleteReturning })),
    })),
  };
});

vi.mock("@/lib/db", () => ({ getDb: () => dbMock }));

const getGameUsageQuery = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/games", () => ({ getGameUsage: getGameUsageQuery }));

import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import {
  createGame,
  deleteGame,
  getGameUsage,
  renameGame,
} from "./game-actions";

const EXISTING = {
  id: "11111111-2222-4333-8444-555555555555",
  name: "Path of Exile",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.mocked(verifySession).mockResolvedValue({ isAuth: true });
  dbMock.insertReturning.mockResolvedValue([EXISTING]);
  dbMock.updateReturning.mockResolvedValue([EXISTING]);
  dbMock.deleteReturning.mockResolvedValue([{ id: EXISTING.id }]);
  getGameUsageQuery.mockResolvedValue({ ideaCount: 0, streamCount: 0 });
});

afterEach(() => {
  dbMock.selectQueue.length = 0;
  vi.clearAllMocks();
});

describe("createGame", () => {
  it("verifies the session before touching the database", async () => {
    await createGame("Hades");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("inserts the normalized name and revalidates the content subtree", async () => {
    dbMock.selectQueue.push([]); // no existing match
    const result = await createGame("  Elden   Ring ");

    expect(dbMock.insertValues).toHaveBeenCalledWith({ name: "Elden Ring" });
    expect(result.game).toEqual(EXISTING);
    expect(revalidatePath).toHaveBeenCalledWith("/content", "layout");
  });

  it("selects the existing entry instead of adding a second copy", async () => {
    dbMock.selectQueue.push([EXISTING]);
    const result = await createGame("  path of   EXILE ");

    expect(result.game).toEqual(EXISTING);
    expect(result.error).toBeUndefined();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("falls back to a re-read when a concurrent insert won the unique index", async () => {
    dbMock.selectQueue.push([]); // nothing found first time round
    dbMock.insertReturning.mockResolvedValueOnce([]); // conflict: nothing inserted
    dbMock.selectQueue.push([EXISTING]); // the row the other request created

    const result = await createGame("Path of Exile");

    expect(result.game).toEqual(EXISTING);
    expect(result.error).toBeUndefined();
  });

  it("rejects a blank name without writing", async () => {
    const result = await createGame("   ");
    expect(result.error).toBe("Name is required");
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe("renameGame", () => {
  it("rewrites the one row every idea and stream points at", async () => {
    dbMock.selectQueue.push([]); // no clashing name
    const result = await renameGame(EXISTING.id, " Path of Exile 2 ");

    expect(dbMock.updateSet).toHaveBeenCalledWith({ name: "Path of Exile 2" });
    expect(result.error).toBeUndefined();
    // Propagation is structural: nothing else is written, because ideas and
    // streams reference the game by id.
    expect(dbMock.update).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/content", "layout");
  });

  it("refuses to rename onto another entry rather than silently merging them", async () => {
    dbMock.selectQueue.push([{ ...EXISTING, id: "other-id", name: "Hades" }]);
    const result = await renameGame(EXISTING.id, "hades");

    expect(result.error).toBe('"Hades" is already in your library.');
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("allows re-casing an entry to itself", async () => {
    dbMock.selectQueue.push([EXISTING]);
    const result = await renameGame(EXISTING.id, "PATH OF EXILE");

    expect(result.error).toBeUndefined();
    expect(dbMock.updateSet).toHaveBeenCalledWith({ name: "PATH OF EXILE" });
  });

  it("returns an error (not a throw) when the game is already gone", async () => {
    dbMock.selectQueue.push([]);
    dbMock.updateReturning.mockResolvedValueOnce([]);

    const result = await renameGame(EXISTING.id, "Hades");
    expect(result.error).toBe("That game no longer exists.");
  });
});

describe("deleteGame", () => {
  it("deletes only the library row — untagging is the FK's job", async () => {
    const result = await deleteGame(EXISTING.id);

    expect(result.error).toBeUndefined();
    // No update against ideas/streams: `ON DELETE SET NULL` on both `game_id`
    // columns is what untags them, so nothing here can delete tagged work.
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/content", "layout");
  });

  it("returns an error when the game no longer exists", async () => {
    dbMock.deleteReturning.mockResolvedValueOnce([]);
    const result = await deleteGame(EXISTING.id);
    expect(result.error).toBe("That game no longer exists.");
  });

  it("rejects a malformed id without writing", async () => {
    const result = await deleteGame("nope");
    expect(result.error).toBe("That game no longer exists.");
    expect(dbMock.delete).not.toHaveBeenCalled();
  });
});

describe("getGameUsage", () => {
  it("reports what a delete would untag", async () => {
    getGameUsageQuery.mockResolvedValueOnce({ ideaCount: 3, streamCount: 1 });
    await expect(getGameUsage(EXISTING.id)).resolves.toEqual({
      ideaCount: 3,
      streamCount: 1,
    });
  });

  it("reports nothing in use for a malformed id rather than querying", async () => {
    await expect(getGameUsage("nope")).resolves.toEqual({
      ideaCount: 0,
      streamCount: 0,
    });
    expect(getGameUsageQuery).not.toHaveBeenCalled();
  });
});
