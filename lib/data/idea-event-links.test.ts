// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A minimal fake of the subset of the Drizzle query builder this module
 * uses: chainable `where`/`orderBy`/`limit`/`*Join`, and awaitable at any
 * point (each real query builder is itself a thenable) — good enough to
 * exercise the grouping/mapping logic without a real database. Successive
 * `select()` calls pull from a shared FIFO queue, mirroring
 * `mockResolvedValueOnce` chaining for functions that issue more than one
 * query (see lib/sync/run.test.ts for the same precedent).
 */
const dbMock = vi.hoisted(() => {
  const queue: unknown[][] = [];
  function next(): Promise<unknown[]> {
    return Promise.resolve(queue.shift() ?? []);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeChain(): any {
    const chain = {
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
        next().then(resolve, reject),
    };
    return chain;
  }
  return {
    queue,
    select: vi.fn(() => ({ from: vi.fn(() => makeChain()) })),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: () => dbMock,
}));

import {
  getLinkedIdeaSummariesForEvents,
  getScheduledEventsForIdeas,
  searchLinkableIdeas,
} from "./idea-event-links";

afterEach(() => {
  dbMock.queue.length = 0;
  vi.clearAllMocks();
});

describe("getLinkedIdeaSummariesForEvents", () => {
  it("returns an empty map without querying for an empty id list", async () => {
    const result = await getLinkedIdeaSummariesForEvents([]);
    expect(result.size).toBe(0);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("groups linked ideas by event id, treating an empty script as no script", async () => {
    dbMock.queue.push([
      {
        eventId: "evt-1",
        ideaId: "idea-1",
        title: "A",
        status: "idea",
        scriptContent: "# hi",
      },
      {
        eventId: "evt-1",
        ideaId: "idea-2",
        title: "B",
        status: "scripted",
        scriptContent: "",
      },
      {
        eventId: "evt-2",
        ideaId: "idea-1",
        title: "A",
        status: "idea",
        scriptContent: null,
      },
    ]);

    const result = await getLinkedIdeaSummariesForEvents(["evt-1", "evt-2"]);

    expect(result.get("evt-1")).toEqual([
      { id: "idea-1", title: "A", status: "idea", hasScript: true },
      { id: "idea-2", title: "B", status: "scripted", hasScript: false },
    ]);
    expect(result.get("evt-2")).toEqual([
      { id: "idea-1", title: "A", status: "idea", hasScript: false },
    ]);
  });
});

describe("getScheduledEventsForIdeas", () => {
  it("returns an empty map without querying for an empty id list", async () => {
    const result = await getScheduledEventsForIdeas([]);
    expect(result.size).toBe(0);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("groups scheduled events by idea id, in the order the query returns them", async () => {
    const startsAt1 = new Date("2026-08-01T10:00:00");
    const endsAt1 = new Date("2026-08-01T11:00:00");
    const startsAt2 = new Date("2026-08-05T09:00:00");
    const endsAt2 = new Date("2026-08-05T10:00:00");
    dbMock.queue.push([
      {
        ideaId: "idea-1",
        eventId: "evt-1",
        title: "Stream A",
        startsAt: startsAt1,
        endsAt: endsAt1,
        allDay: false,
      },
      {
        ideaId: "idea-1",
        eventId: "evt-2",
        title: "Stream B",
        startsAt: startsAt2,
        endsAt: endsAt2,
        allDay: false,
      },
    ]);

    const result = await getScheduledEventsForIdeas(["idea-1"]);

    expect(result.get("idea-1")).toEqual([
      {
        id: "evt-1",
        title: "Stream A",
        startsAt: startsAt1,
        endsAt: endsAt1,
        allDay: false,
      },
      {
        id: "evt-2",
        title: "Stream B",
        startsAt: startsAt2,
        endsAt: endsAt2,
        allDay: false,
      },
    ]);
  });
});

describe("searchLinkableIdeas", () => {
  it("returns whatever the final (filtered) query resolves to", async () => {
    dbMock.queue.push([{ ideaId: "idea-1" }]); // already-linked ids
    dbMock.queue.push([
      {
        id: "idea-2",
        title: "Glitch tutorial",
        format: "video",
        status: "idea",
      },
    ]);

    const result = await searchLinkableIdeas("evt-1", "glitch");

    expect(result).toEqual([
      {
        id: "idea-2",
        title: "Glitch tutorial",
        format: "video",
        status: "idea",
      },
    ]);
  });

  it("returns an empty array when nothing matches", async () => {
    dbMock.queue.push([]);
    dbMock.queue.push([]);

    const result = await searchLinkableIdeas("evt-1", "nomatch");

    expect(result).toEqual([]);
  });
});
