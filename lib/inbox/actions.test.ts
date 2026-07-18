// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ verifySession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data/daily-logs", () => ({
  getOrCreateLog: vi.fn(),
  nextItemPosition: vi.fn(),
}));
vi.mock("@/lib/journal/dates", () => ({ todayParam: () => "2026-07-18" }));

// A db mock that records every insert (table + values), captures the batch
// argument, and lets a test queue the entry-existence select result and the
// discard update's returning result.
const dbMock = vi.hoisted(() => {
  const insertCalls: { table: unknown; values: unknown }[] = [];
  const batchCalls: unknown[][] = [];
  const selectQueue: unknown[][] = [];
  let updateReturning: unknown[] = [];

  function nextSelect(): Promise<unknown[]> {
    return Promise.resolve(selectQueue.shift() ?? []);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeSelectChain(): any {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
        nextSelect().then(resolve, reject),
    };
    return chain;
  }

  return {
    insertCalls,
    batchCalls,
    selectQueue,
    setUpdateReturning(rows: unknown[]) {
      updateReturning = rows;
    },
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        insertCalls.push({ table, values });
        return { __stmt: "insert", table };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => ({
        where: vi.fn(() => ({
          __stmt: "update",
          values,
          returning: vi.fn(() => Promise.resolve(updateReturning)),
        })),
      })),
    })),
    batch: vi.fn((stmts: unknown[]) => {
      batchCalls.push(stmts);
      return Promise.resolve([]);
    }),
  };
});

vi.mock("@/lib/db", () => ({ getDb: () => dbMock }));

import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import { getOrCreateLog, nextItemPosition } from "@/lib/data/daily-logs";
import {
  dailyLogItems,
  ideas,
  improvements,
  inboxEntries,
  meetingNotes,
} from "@/lib/db/schema";

import { captureEntry, discardEntry, triageEntry } from "./actions";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.mocked(verifySession).mockResolvedValue({ isAuth: true });
  vi.mocked(getOrCreateLog).mockResolvedValue({
    id: "log-1",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(nextItemPosition).mockResolvedValue(3);
  dbMock.setUpdateReturning([{ id: "entry-1" }]);
});

afterEach(() => {
  dbMock.insertCalls.length = 0;
  dbMock.batchCalls.length = 0;
  dbMock.selectQueue.length = 0;
  vi.clearAllMocks();
});

describe("captureEntry", () => {
  it("inserts a trimmed body and reports success", async () => {
    const result = await captureEntry(undefined, form({ body: "  new idea " }));
    expect(result.success).toBe(true);
    expect(dbMock.insertCalls).toHaveLength(1);
    expect(dbMock.insertCalls[0].table).toBe(inboxEntries);
    expect(dbMock.insertCalls[0].values).toMatchObject({ body: "new idea" });
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("rejects a whitespace-only body without inserting", async () => {
    const result = await captureEntry(undefined, form({ body: "   " }));
    expect(result.fieldError).toBeTruthy();
    expect(result.success).toBeUndefined();
    expect(dbMock.insertCalls).toHaveLength(0);
  });
});

describe("triageEntry", () => {
  beforeEach(() => {
    // Every happy-path triage first reads the entry to confirm it's untriaged.
    dbMock.selectQueue.push([{ id: "entry-1", triagedAt: null }]);
  });

  it("maps a content idea and batches the destination insert with the entry update", async () => {
    const result = await triageEntry("entry-1", {
      type: "content_idea",
      title: "Retro video",
      notes: "cover the highlights",
    });
    expect(result.success).toBe(true);
    expect(dbMock.insertCalls[0].table).toBe(ideas);
    expect(dbMock.insertCalls[0].values).toMatchObject({
      title: "Retro video",
      notes: "cover the highlights",
    });
    // Atomicity: destination insert + entry update go in one batch.
    expect(dbMock.batchCalls).toHaveLength(1);
    expect(dbMock.batchCalls[0]).toHaveLength(2);
  });

  it("maps an improvement", async () => {
    await triageEntry("entry-1", {
      type: "improvement",
      title: "Speed up CI",
      rationale: "builds take too long",
    });
    expect(dbMock.insertCalls[0].table).toBe(improvements);
    expect(dbMock.insertCalls[0].values).toMatchObject({
      title: "Speed up CI",
      rationale: "builds take too long",
    });
  });

  it("maps a daily-log item onto today's log as planned", async () => {
    await triageEntry("entry-1", {
      type: "daily_log_item",
      title: "Review the PR",
    });
    expect(getOrCreateLog).toHaveBeenCalledWith("2026-07-18");
    expect(dbMock.insertCalls[0].table).toBe(dailyLogItems);
    expect(dbMock.insertCalls[0].values).toMatchObject({
      logId: "log-1",
      title: "Review the PR",
      status: "planned",
      position: 3,
    });
  });

  it("maps a meeting note", async () => {
    await triageEntry("entry-1", {
      type: "meeting_note",
      date: "2026-07-18",
      title: "Sprint planning",
      notes: "roadmap discussion",
    });
    expect(dbMock.insertCalls[0].table).toBe(meetingNotes);
    expect(dbMock.insertCalls[0].values).toMatchObject({
      date: "2026-07-18",
      title: "Sprint planning",
      notes: "roadmap discussion",
    });
  });

  it("stamps the entry with the created destination id", async () => {
    const result = await triageEntry("entry-1", {
      type: "improvement",
      title: "x",
    });
    const updateStmt = (dbMock.batchCalls[0] as { values: unknown }[])[1] as {
      values: { triagedToType: string; triagedToId: string; triagedAt: Date };
    };
    expect(updateStmt.values.triagedToType).toBe("improvement");
    expect(updateStmt.values.triagedToId).toBe(result.destinationId);
    expect(updateStmt.values.triagedAt).toBeInstanceOf(Date);
  });

  it("rejects an invalid payload without touching the db", async () => {
    dbMock.selectQueue.length = 0; // no entry read expected
    const result = await triageEntry("entry-1", {
      type: "content_idea",
      title: "",
    });
    expect(result.error).toBeTruthy();
    expect(dbMock.batchCalls).toHaveLength(0);
  });
});

describe("triageEntry guards", () => {
  it("refuses when the entry no longer exists", async () => {
    dbMock.selectQueue.push([]);
    const result = await triageEntry("gone", {
      type: "improvement",
      title: "x",
    });
    expect(result.error).toMatch(/no longer exists/);
    expect(dbMock.batchCalls).toHaveLength(0);
  });

  it("refuses when the entry was already triaged", async () => {
    dbMock.selectQueue.push([{ id: "entry-1", triagedAt: new Date() }]);
    const result = await triageEntry("entry-1", {
      type: "improvement",
      title: "x",
    });
    expect(result.error).toMatch(/already triaged/);
    expect(dbMock.batchCalls).toHaveLength(0);
  });
});

describe("discardEntry", () => {
  it("stamps the entry discarded and reports success", async () => {
    dbMock.setUpdateReturning([{ id: "entry-1" }]);
    const result = await discardEntry("entry-1");
    expect(result.success).toBe(true);
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("reports an error when the entry was already gone", async () => {
    dbMock.setUpdateReturning([]);
    const result = await discardEntry("entry-1");
    expect(result.error).toBeTruthy();
    expect(result.success).toBeUndefined();
  });
});
