// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  aggregateLinkedImprovementCounts,
  sortMeetingNotes,
  type MeetingNoteSummary,
} from "./meeting-notes";

function summary(
  overrides: Partial<MeetingNoteSummary> = {}
): MeetingNoteSummary {
  return {
    id: "m-1",
    date: "2026-07-01",
    title: "Weekly sync",
    meetingType: "standup",
    reflection: null,
    projectId: null,
    projectName: null,
    eventId: null,
    linkedImprovementCount: 0,
    createdAt: new Date("2026-07-01T09:00:00Z"),
    updatedAt: new Date("2026-07-01T09:00:00Z"),
    ...overrides,
  };
}

describe("sortMeetingNotes", () => {
  it("orders by date descending", () => {
    const older = summary({ id: "older", date: "2026-07-01" });
    const newer = summary({ id: "newer", date: "2026-07-05" });
    const result = sortMeetingNotes([older, newer]);
    expect(result.map((m) => m.id)).toEqual(["newer", "older"]);
  });

  it("breaks a same-day tie by most-recently-created first", () => {
    const first = summary({
      id: "first",
      date: "2026-07-01",
      createdAt: new Date("2026-07-01T09:00:00Z"),
    });
    const second = summary({
      id: "second",
      date: "2026-07-01",
      createdAt: new Date("2026-07-01T14:00:00Z"),
    });
    const result = sortMeetingNotes([first, second]);
    expect(result.map((m) => m.id)).toEqual(["second", "first"]);
  });

  it("does not mutate the input array", () => {
    const input = [summary({ id: "a" }), summary({ id: "b" })];
    const copy = [...input];
    sortMeetingNotes(input);
    expect(input).toEqual(copy);
  });
});

describe("aggregateLinkedImprovementCounts", () => {
  it("counts join rows per meeting note", () => {
    const result = aggregateLinkedImprovementCounts([
      { meetingNoteId: "m-1" },
      { meetingNoteId: "m-1" },
      { meetingNoteId: "m-2" },
    ]);
    expect(result.get("m-1")).toBe(2);
    expect(result.get("m-2")).toBe(1);
    expect(result.get("m-3")).toBeUndefined();
  });
});

// --- DB-backed query tests (mocked, per lib/data/improvements.test.ts) ---

const dbMock = vi.hoisted(() => {
  const queue: unknown[][] = [];
  function next(): Promise<unknown[]> {
    return Promise.resolve(queue.shift() ?? []);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeChain(): any {
    const chain = {
      leftJoin: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
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
  getImprovementsForMeetingNote,
  getMeetingNote,
  getMeetingNotesForProject,
  listMeetingNotes,
  searchAttachableEvents,
  searchLinkableImprovements,
} from "./meeting-notes";

afterEach(() => {
  dbMock.queue.length = 0;
  vi.clearAllMocks();
});

describe("listMeetingNotes", () => {
  it("returns rows sorted newest-first, with project chip data joined in", async () => {
    dbMock.queue.push([
      {
        id: "m-1",
        date: "2026-07-01",
        title: "Weekly sync",
        meetingType: "standup",
        reflection: null,
        projectId: "p-1",
        projectName: "Keystroke Hub",
        eventId: null,
        createdAt: new Date("2026-07-01T09:00:00Z"),
        updatedAt: new Date("2026-07-01T09:00:00Z"),
      },
      {
        id: "m-2",
        date: "2026-07-05",
        title: "Planning",
        meetingType: "planning",
        reflection: "Went well",
        projectId: null,
        projectName: null,
        eventId: null,
        createdAt: new Date("2026-07-05T09:00:00Z"),
        updatedAt: new Date("2026-07-05T09:00:00Z"),
      },
    ]);
    dbMock.queue.push([{ meetingNoteId: "m-1" }, { meetingNoteId: "m-1" }]);

    const result = await listMeetingNotes();
    expect(result.map((m) => m.id)).toEqual(["m-2", "m-1"]);
    expect(result[1].projectName).toBe("Keystroke Hub");
    expect(result[1].linkedImprovementCount).toBe(2);
    expect(result[0].linkedImprovementCount).toBe(0);
  });
});

describe("getMeetingNote", () => {
  it("returns null when no row matches", async () => {
    dbMock.queue.push([]);
    const result = await getMeetingNote("missing");
    expect(result).toBeNull();
  });

  it("assembles the meeting note, its event, and linked improvements", async () => {
    dbMock.queue.push([
      {
        id: "m-1",
        date: "2026-07-01",
        title: "Weekly sync",
        meetingType: "standup",
        notes: "Discussed the roadmap.",
        reflection: null,
        projectId: null,
        projectName: null,
        eventId: "e-1",
        eventTitle: "Team sync",
        eventStartsAt: new Date("2026-07-01T09:00:00Z"),
        eventEndsAt: new Date("2026-07-01T09:30:00Z"),
        eventAllDay: false,
        createdAt: new Date("2026-07-01T09:00:00Z"),
        updatedAt: new Date("2026-07-01T09:00:00Z"),
      },
    ]);
    dbMock.queue.push([
      { id: "i-1", title: "Automate the changelog", status: "proposed" },
    ]);

    const result = await getMeetingNote("m-1");
    expect(result?.event).toEqual({
      id: "e-1",
      title: "Team sync",
      startsAt: new Date("2026-07-01T09:00:00Z"),
      endsAt: new Date("2026-07-01T09:30:00Z"),
      allDay: false,
    });
    expect(result?.linkedImprovements).toEqual([
      { id: "i-1", title: "Automate the changelog", status: "proposed" },
    ]);
  });
});

describe("getImprovementsForMeetingNote", () => {
  it("returns whatever the query resolves to", async () => {
    dbMock.queue.push([{ id: "i-1", title: "Improvement", status: "done" }]);
    const result = await getImprovementsForMeetingNote("m-1");
    expect(result).toEqual([
      { id: "i-1", title: "Improvement", status: "done" },
    ]);
  });
});

describe("getMeetingNotesForProject", () => {
  it("returns whatever the query resolves to", async () => {
    dbMock.queue.push([
      { id: "m-1", date: "2026-07-01", title: "Weekly sync" },
    ]);
    const result = await getMeetingNotesForProject("p-1");
    expect(result).toEqual([
      { id: "m-1", date: "2026-07-01", title: "Weekly sync" },
    ]);
  });
});

describe("searchAttachableEvents", () => {
  it("returns whatever the query resolves to, after checking claimed events", async () => {
    dbMock.queue.push([{ eventId: "e-1" }]);
    dbMock.queue.push([
      {
        id: "e-2",
        title: "Standup",
        startsAt: new Date("2026-07-01T09:00:00Z"),
        endsAt: new Date("2026-07-01T09:15:00Z"),
        allDay: false,
      },
    ]);
    const result = await searchAttachableEvents("");
    expect(result).toEqual([
      {
        id: "e-2",
        title: "Standup",
        startsAt: new Date("2026-07-01T09:00:00Z"),
        endsAt: new Date("2026-07-01T09:15:00Z"),
        allDay: false,
      },
    ]);
  });
});

describe("searchLinkableImprovements", () => {
  it("returns whatever the query resolves to, excluding already-linked improvements", async () => {
    dbMock.queue.push([{ improvementId: "i-1" }]);
    dbMock.queue.push([
      { id: "i-2", title: "Add a status page", status: "proposed" },
    ]);
    const result = await searchLinkableImprovements("m-1", "");
    expect(result).toEqual([
      { id: "i-2", title: "Add a status page", status: "proposed" },
    ]);
  });
});
