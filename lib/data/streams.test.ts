// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { aggregateChecklistProgress, bucketStreams } from "./streams";
import type { StreamSummary } from "./streams";

describe("aggregateChecklistProgress", () => {
  it("returns an empty map for no rows", () => {
    expect(aggregateChecklistProgress([]).size).toBe(0);
  });

  it("counts done vs. total per stream", () => {
    const result = aggregateChecklistProgress([
      { streamId: "s-1", done: true },
      { streamId: "s-1", done: false },
      { streamId: "s-1", done: true },
      { streamId: "s-2", done: false },
    ]);
    expect(result.get("s-1")).toEqual({ done: 2, total: 3 });
    expect(result.get("s-2")).toEqual({ done: 0, total: 1 });
  });
});

function summary(overrides: Partial<StreamSummary> = {}): StreamSummary {
  return {
    id: "s-1",
    title: "Stream",
    retroNotes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    event: null,
    checklistDone: 0,
    checklistTotal: 0,
    ...overrides,
  };
}

describe("bucketStreams", () => {
  const now = new Date("2026-07-09T12:00:00Z");

  it("puts a stream with no linked event in unscheduled", () => {
    const result = bucketStreams([summary({ id: "s-1", event: null })], now);
    expect(result.unscheduled.map((s) => s.id)).toEqual(["s-1"]);
    expect(result.upcoming).toEqual([]);
    expect(result.past).toEqual([]);
  });

  it("puts a stream starting after now in upcoming", () => {
    const result = bucketStreams(
      [
        summary({
          id: "s-1",
          event: {
            id: "e-1",
            title: "E",
            startsAt: new Date("2026-07-10T12:00:00Z"),
            endsAt: new Date("2026-07-10T14:00:00Z"),
            allDay: false,
          },
        }),
      ],
      now
    );
    expect(result.upcoming.map((s) => s.id)).toEqual(["s-1"]);
  });

  it("treats the boundary (starting exactly now) as past, not upcoming", () => {
    const result = bucketStreams(
      [
        summary({
          id: "s-1",
          event: {
            id: "e-1",
            title: "E",
            startsAt: now,
            endsAt: new Date(now.getTime() + 60 * 60 * 1000),
            allDay: false,
          },
        }),
      ],
      now
    );
    expect(result.past.map((s) => s.id)).toEqual(["s-1"]);
    expect(result.upcoming).toEqual([]);
  });

  it("puts a stream starting earlier today (same day) in past — the boundary is start time, not end of day", () => {
    const earlierToday = new Date("2026-07-09T08:00:00Z");
    const result = bucketStreams(
      [
        summary({
          id: "s-1",
          event: {
            id: "e-1",
            title: "E",
            startsAt: earlierToday,
            endsAt: new Date(earlierToday.getTime() + 60 * 60 * 1000),
            allDay: false,
          },
        }),
      ],
      now
    );
    expect(result.past.map((s) => s.id)).toEqual(["s-1"]);
  });

  it("sorts upcoming soonest-first", () => {
    const later = summary({
      id: "later",
      event: {
        id: "e-2",
        title: "Later",
        startsAt: new Date("2026-07-20T12:00:00Z"),
        endsAt: new Date("2026-07-20T14:00:00Z"),
        allDay: false,
      },
    });
    const sooner = summary({
      id: "sooner",
      event: {
        id: "e-1",
        title: "Sooner",
        startsAt: new Date("2026-07-11T12:00:00Z"),
        endsAt: new Date("2026-07-11T14:00:00Z"),
        allDay: false,
      },
    });
    const result = bucketStreams([later, sooner], now);
    expect(result.upcoming.map((s) => s.id)).toEqual(["sooner", "later"]);
  });

  it("sorts past most-recent-first", () => {
    const older = summary({
      id: "older",
      event: {
        id: "e-2",
        title: "Older",
        startsAt: new Date("2026-06-01T12:00:00Z"),
        endsAt: new Date("2026-06-01T14:00:00Z"),
        allDay: false,
      },
    });
    const recent = summary({
      id: "recent",
      event: {
        id: "e-1",
        title: "Recent",
        startsAt: new Date("2026-07-01T12:00:00Z"),
        endsAt: new Date("2026-07-01T14:00:00Z"),
        allDay: false,
      },
    });
    const result = bucketStreams([older, recent], now);
    expect(result.past.map((s) => s.id)).toEqual(["recent", "older"]);
  });

  it("sorts unscheduled newest-created-first", () => {
    const older = summary({
      id: "older",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const newer = summary({
      id: "newer",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    });
    const result = bucketStreams([older, newer], now);
    expect(result.unscheduled.map((s) => s.id)).toEqual(["newer", "older"]);
  });
});

// --- DB-backed query tests (mocked, per `lib/data/idea-event-links.test.ts`) ---

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
  getStreamsOverview,
  getStreamWithChecklist,
  getTemplateItems,
  searchAttachableEvents,
} from "./streams";

afterEach(() => {
  dbMock.queue.length = 0;
  vi.clearAllMocks();
});

describe("getStreamsOverview", () => {
  it("joins streams to their event and buckets them, in one checklist-progress query", async () => {
    const streamRow = {
      id: "s-1",
      title: "Boss rush",
      notes: null,
      retroNotes: null,
      eventId: "e-1",
      eventTrack: "content",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    dbMock.queue.push([
      {
        stream: streamRow,
        eventTitle: "Stream night",
        eventStartsAt: new Date("2026-07-10T19:00:00Z"),
        eventEndsAt: new Date("2026-07-10T21:00:00Z"),
        eventAllDay: false,
      },
    ]);
    dbMock.queue.push([{ streamId: "s-1", done: true }]);

    const result = await getStreamsOverview(new Date("2026-07-09T00:00:00Z"));

    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0]).toMatchObject({
      id: "s-1",
      checklistDone: 1,
      checklistTotal: 1,
      event: { id: "e-1", title: "Stream night" },
    });
  });

  it("skips the checklist-progress query entirely when there are no streams", async () => {
    dbMock.queue.push([]);
    const result = await getStreamsOverview();
    expect(result).toEqual({ upcoming: [], unscheduled: [], past: [] });
    expect(dbMock.select).toHaveBeenCalledTimes(1);
  });
});

describe("getStreamWithChecklist", () => {
  it("returns null when the stream doesn't exist", async () => {
    dbMock.queue.push([]);
    const result = await getStreamWithChecklist("missing");
    expect(result).toBeNull();
  });

  it("returns the stream, its event, and ordered checklist items", async () => {
    const streamRow = {
      id: "s-1",
      title: "Boss rush",
      notes: null,
      retroNotes: null,
      eventId: null,
      eventTrack: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dbMock.queue.push([
      {
        stream: streamRow,
        eventTitle: null,
        eventStartsAt: null,
        eventEndsAt: null,
        eventAllDay: null,
      },
    ]);
    dbMock.queue.push([{ id: "item-1", label: "Check mic", position: 0 }]);

    const result = await getStreamWithChecklist("s-1");
    expect(result?.event).toBeNull();
    expect(result?.checklist).toEqual([
      { id: "item-1", label: "Check mic", position: 0 },
    ]);
  });
});

describe("getTemplateItems", () => {
  it("returns whatever the query resolves to", async () => {
    dbMock.queue.push([{ id: "t-1", label: "Check mic", position: 0 }]);
    const result = await getTemplateItems();
    expect(result).toEqual([{ id: "t-1", label: "Check mic", position: 0 }]);
  });
});

describe("searchAttachableEvents", () => {
  it("excludes events already claimed by a stream", async () => {
    dbMock.queue.push([{ eventId: "e-1" }, { eventId: null }]);
    dbMock.queue.push([{ id: "e-2", title: "Unclaimed stream night" }]);

    const result = await searchAttachableEvents("");

    expect(result).toEqual([{ id: "e-2", title: "Unclaimed stream night" }]);
  });
});
