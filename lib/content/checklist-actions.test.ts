// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  verifySession: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const dbMock = vi.hoisted(() => {
  // Mirrors `stream-actions.test.ts`'s `makeSelectChain` precedent: a
  // `select().from()` chain is awaitable with or without a `.where()` link.
  const selectQueue: unknown[][] = [];
  function nextSelect(): Promise<unknown[]> {
    return Promise.resolve(selectQueue.shift() ?? []);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeSelectChain(): any {
    const chain = {
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
        nextSelect().then(resolve, reject),
    };
    return chain;
  }

  const insertValues = vi.fn(() => Promise.resolve());
  const updateSet = vi.fn();
  const updateReturning = vi.fn();

  return {
    selectQueue,
    insertValues,
    updateSet,
    updateReturning,
    select: vi.fn(() => ({ from: vi.fn(() => makeSelectChain()) })),
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({
      set: vi.fn((values) => {
        updateSet(values);
        return { where: vi.fn(() => ({ returning: updateReturning })) };
      }),
    })),
    delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: () => dbMock,
}));

import { verifySession } from "@/lib/auth/session";
import {
  addIdeaChecklistItem,
  getIdeaChecklistItems,
  removeIdeaChecklistItem,
  toggleIdeaChecklistItem,
} from "./checklist-actions";

beforeEach(() => {
  vi.mocked(verifySession).mockResolvedValue({ isAuth: true });
  dbMock.updateReturning.mockResolvedValue([{ id: "item-1" }]);
});

afterEach(() => {
  dbMock.selectQueue.length = 0;
  vi.clearAllMocks();
});

describe("getIdeaChecklistItems", () => {
  it("verifies the session before querying", async () => {
    dbMock.selectQueue.push([{ id: "item-1", label: "Title" }]);
    await getIdeaChecklistItems("idea-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });
});

describe("toggleIdeaChecklistItem", () => {
  it("verifies the session before writing", async () => {
    await toggleIdeaChecklistItem("idea-1", "item-1", true);
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — toggling to the same value succeeds without error", async () => {
    dbMock.updateReturning.mockResolvedValue([{ id: "item-1" }]);
    const first = await toggleIdeaChecklistItem("idea-1", "item-1", true);
    const second = await toggleIdeaChecklistItem("idea-1", "item-1", true);
    expect(first).toEqual({});
    expect(second).toEqual({});
  });

  it("returns an error when the item no longer exists", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await toggleIdeaChecklistItem("idea-1", "missing", true);
    expect(result).toEqual({ error: "That checklist item no longer exists." });
  });
});

describe("addIdeaChecklistItem", () => {
  it("verifies the session before writing", async () => {
    dbMock.selectQueue.push([{ id: "idea-1" }]);
    dbMock.selectQueue.push([]);
    await addIdeaChecklistItem("idea-1", "Check description");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("appends at the next position after the current max", async () => {
    dbMock.selectQueue.push([{ id: "idea-1" }]);
    dbMock.selectQueue.push([{ position: 0 }, { position: 1 }]);

    await addIdeaChecklistItem("idea-1", "Check description");

    expect(dbMock.insertValues).toHaveBeenCalledWith({
      ideaId: "idea-1",
      label: "Check description",
      position: 2,
    });
  });

  it("rejects a blank label without writing", async () => {
    const result = await addIdeaChecklistItem("idea-1", "   ");
    expect(result.error).toBeTruthy();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("returns an error when the idea no longer exists", async () => {
    dbMock.selectQueue.push([]);
    const result = await addIdeaChecklistItem("missing", "Check description");
    expect(result).toEqual({ error: "That idea no longer exists." });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe("removeIdeaChecklistItem", () => {
  it("verifies the session and deletes scoped by ideaId", async () => {
    await removeIdeaChecklistItem("idea-1", "item-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
  });
});
