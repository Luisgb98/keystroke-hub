// @vitest-environment node
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ideas } from "@/lib/db/schema";
import { monthRange } from "@/lib/dashboard/month-review";

const dbMock = vi.hoisted(() => {
  const selectQueue: unknown[][] = [];
  const executeQueue: unknown[][] = [];
  const calls: { table: unknown; columns: unknown }[] = [];

  function next(): Promise<unknown[]> {
    return Promise.resolve(selectQueue.shift() ?? []);
  }

  // Awaitable at any link in the chain: the queries here end variously on
  // `.where()`, `.groupBy()` and `.innerJoin()` (mirrors the chain mock in
  // `lib/data/games.test.ts`).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeChain(): any {
    const chain = {
      where: vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
        next().then(resolve, reject),
    };
    return chain;
  }

  return {
    selectQueue,
    executeQueue,
    calls,
    select: vi.fn((columns?: unknown) => ({
      from: vi.fn((table: unknown) => {
        calls.push({ table, columns });
        return makeChain();
      }),
    })),
    // The parameter is declared (rather than ignored) so the recorded call
    // is typed — `getTagUsage`'s statement is read back and rendered below.
    execute: vi.fn((statement: SQL) => {
      void statement;
      return Promise.resolve({ rows: executeQueue.shift() ?? [] });
    }),
  };
});

vi.mock("@/lib/db", () => ({ getDb: () => dbMock }));

import {
  getGameAttention,
  getMonthOutput,
  getPipelineSnapshot,
  getTagUsage,
  ideaTouchedInMonth,
  monthCondition,
} from "./dashboard";

const dialect = new PgDialect();
const AUGUST = monthRange("2026-08");
const NOW = new Date("2026-08-09T10:00:00Z");

beforeEach(() => {
  dbMock.selectQueue.length = 0;
  dbMock.executeQueue.length = 0;
  dbMock.calls.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("monthCondition", () => {
  it("is half-open: >= the first instant, < the first instant of the next month", () => {
    const { sql, params } = dialect.sqlToQuery(
      monthCondition(ideas.createdAt, AUGUST)
    );
    expect(sql).toContain('"created_at" >= $1');
    expect(sql).toContain('"created_at" < $2');
    // Madrid is UTC+2 in August: the month runs 22:00 Jul 31 → 22:00 Aug 31.
    // Drizzle has already serialized the bounds to absolute ISO strings.
    expect(params[0]).toBe("2026-07-31T22:00:00.000Z");
    expect(params[1]).toBe("2026-08-31T22:00:00.000Z");
  });

  it("bounds the winter offset just as exactly — no fixed +2h assumption", () => {
    const { params } = dialect.sqlToQuery(
      monthCondition(ideas.createdAt, monthRange("2026-01"))
    );
    expect(params[0]).toBe("2025-12-31T23:00:00.000Z");
    expect(params[1]).toBe("2026-01-31T23:00:00.000Z");
  });

  it("meets the previous month's upper bound exactly, so no row falls between two months", () => {
    const july = dialect.sqlToQuery(
      monthCondition(ideas.createdAt, monthRange("2026-07"))
    );
    const august = dialect.sqlToQuery(monthCondition(ideas.createdAt, AUGUST));
    expect(july.params[1]).toBe(august.params[0]);
  });
});

describe("ideaTouchedInMonth", () => {
  it("counts an idea captured OR moved in the month", () => {
    const { sql, params } = dialect.sqlToQuery(ideaTouchedInMonth(AUGUST));
    expect(sql).toContain('"created_at"');
    expect(sql).toContain('"stage_entered_at"');
    expect(sql).toContain(" or ");
    expect(params).toHaveLength(4);
  });
});

describe("getMonthOutput", () => {
  it("coerces the bigint counts the driver hands back as strings", async () => {
    dbMock.selectQueue.push(
      [{ value: "2" }], // published
      [{ value: "3" }], // streams
      [{ value: "7" }] // ideas created
    );

    await expect(getMonthOutput(AUGUST, NOW)).resolves.toEqual({
      publishedVideos: 2,
      streamsHeld: 3,
      ideasCreated: 7,
    });
  });

  it("reports honest zeros for a month with nothing in it", async () => {
    dbMock.selectQueue.push([], [], []);
    await expect(getMonthOutput(AUGUST, NOW)).resolves.toEqual({
      publishedVideos: 0,
      streamsHeld: 0,
      ideasCreated: 0,
    });
  });

  it("counts only streams whose slot is in the past, so a booked stream isn't output yet", async () => {
    dbMock.selectQueue.push(
      [{ value: "0" }],
      [{ value: "0" }],
      [{ value: "0" }]
    );
    await getMonthOutput(AUGUST, NOW);

    const streamChain =
      dbMock.select.mock.results[1].value.from.mock.results[0].value;
    const [condition] = streamChain.where.mock.calls[0];
    const { sql, params } = dialect.sqlToQuery(condition);
    expect(sql).toContain('"starts_at" <= ');
    expect(params).toContain(NOW.toISOString());
  });
});

describe("getPipelineSnapshot", () => {
  it("zero-fills every stage, in pipeline order, from a partial group-by result", async () => {
    dbMock.selectQueue.push(
      [
        { status: "scripted", value: "2" },
        { status: "published", value: "1" },
      ],
      [{ value: "1" }]
    );

    const snapshot = await getPipelineSnapshot(AUGUST);
    expect(snapshot.stages).toEqual([
      { status: "idea", count: 0 },
      { status: "scripted", count: 2 },
      { status: "recorded", count: 0 },
      { status: "edited", count: 0 },
      { status: "published", count: 1 },
    ]);
    expect(snapshot.total).toBe(3);
    expect(snapshot.lateStageMoves).toBe(1);
  });

  it("reports an empty pipeline as zeros rather than an empty list", async () => {
    dbMock.selectQueue.push([], []);
    const snapshot = await getPipelineSnapshot(AUGUST);
    expect(snapshot.stages).toHaveLength(5);
    expect(snapshot.total).toBe(0);
    expect(snapshot.lateStageMoves).toBe(0);
  });

  it("scopes late-stage movement to the month, by when the stage was entered", async () => {
    dbMock.selectQueue.push([], []);
    await getPipelineSnapshot(AUGUST);

    const lateChain =
      dbMock.select.mock.results[1].value.from.mock.results[0].value;
    const [condition] = lateChain.where.mock.calls[0];
    const { sql } = dialect.sqlToQuery(condition);
    expect(sql).toContain('"stage_entered_at"');
    expect(sql).toContain('"status" in');
  });
});

describe("getGameAttention", () => {
  it("merges the idea and stream tallies into one ranked list", async () => {
    dbMock.selectQueue.push(
      [
        { gameId: "g1", gameName: "Hades", value: "3" },
        { gameId: null, gameName: null, value: "1" },
      ],
      [{ gameId: "g1", gameName: "Hades", value: "2" }]
    );

    await expect(getGameAttention(AUGUST, NOW)).resolves.toEqual([
      {
        gameId: "g1",
        name: "Hades",
        ideaCount: 3,
        streamCount: 2,
        total: 5,
      },
      {
        gameId: null,
        name: "No game",
        ideaCount: 1,
        streamCount: 0,
        total: 1,
      },
    ]);
  });

  it("is empty for a month with no ideas and no streams", async () => {
    dbMock.selectQueue.push([], []);
    await expect(getGameAttention(AUGUST, NOW)).resolves.toEqual([]);
  });
});

describe("getTagUsage", () => {
  it("unnests tags inside a subquery, because Postgres groups before it expands a set", async () => {
    dbMock.executeQueue.push([
      { tag: "speedrun", count: "4" },
      { tag: "vod", count: "1" },
    ]);

    await expect(getTagUsage(AUGUST, 6)).resolves.toEqual([
      { tag: "speedrun", count: 4 },
      { tag: "vod", count: 1 },
    ]);

    const [statement] = dbMock.execute.mock.calls[0];
    const { sql, params } = dialect.sqlToQuery(statement);
    expect(sql).toMatch(/from\s*\(\s*select unnest/);
    expect(sql).toContain("group by tag");
    // Four month bounds (created-or-moved) plus the limit.
    expect(params).toHaveLength(5);
    expect(params.at(-1)).toBe(6);
  });

  it("is empty for a month whose ideas carry no tags", async () => {
    dbMock.executeQueue.push([]);
    await expect(getTagUsage(AUGUST, 6)).resolves.toEqual([]);
  });
});
