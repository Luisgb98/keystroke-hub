// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => {
  const resultQueue: unknown[][] = [];
  function nextResult(): Promise<unknown[]> {
    return Promise.resolve(resultQueue.shift() ?? []);
  }
  // A chain whose every builder method returns itself and which resolves to
  // the next queued result when awaited — covers where/orderBy in any order.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeChain(): any {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
        nextResult().then(resolve, reject),
    };
    return chain;
  }
  return {
    resultQueue,
    select: vi.fn(() => makeChain()),
  };
});

vi.mock("@/lib/db", () => ({ getDb: () => dbMock }));

import { getEntry, getUntriagedCount, getUntriagedEntries } from "./queries";

beforeEach(() => {
  dbMock.resultQueue.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getUntriagedEntries", () => {
  it("returns the queued rows (oldest-first ordering is the DB's job)", async () => {
    const rows = [
      { id: "a", body: "first", createdAt: new Date("2026-07-01") },
      { id: "b", body: "second", createdAt: new Date("2026-07-02") },
    ];
    dbMock.resultQueue.push(rows);
    await expect(getUntriagedEntries()).resolves.toEqual(rows);
  });

  it("returns an empty array when nothing is untriaged", async () => {
    dbMock.resultQueue.push([]);
    await expect(getUntriagedEntries()).resolves.toEqual([]);
  });
});

describe("getUntriagedCount", () => {
  it("unwraps the count aggregate row", async () => {
    dbMock.resultQueue.push([{ value: 3 }]);
    await expect(getUntriagedCount()).resolves.toBe(3);
  });

  it("returns 0 when the aggregate row is missing", async () => {
    dbMock.resultQueue.push([]);
    await expect(getUntriagedCount()).resolves.toBe(0);
  });
});

describe("getEntry", () => {
  it("returns the first matching row", async () => {
    const row = { id: "a", body: "x" };
    dbMock.resultQueue.push([row]);
    await expect(getEntry("a")).resolves.toEqual(row);
  });

  it("returns null when the entry is gone", async () => {
    dbMock.resultQueue.push([]);
    await expect(getEntry("missing")).resolves.toBeNull();
  });
});
