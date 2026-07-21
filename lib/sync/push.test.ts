// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./run", () => ({
  getConnectionForTrack: vi.fn(),
  getConnectionById: vi.fn(),
  getValidAccessToken: vi.fn(),
}));
vi.mock("@/lib/google/client", () => ({
  createGoogleCalendarClient: vi.fn(),
}));

const dbMock = vi.hoisted(() => {
  const state: {
    eventRows: unknown[];
    linkRows: unknown[];
    inserted: unknown;
    updated: unknown;
    deletedWhere: unknown;
  } = {
    eventRows: [],
    linkRows: [],
    inserted: undefined,
    updated: undefined,
    deletedWhere: undefined,
  };

  return {
    state,
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(async () =>
          table === EVENTS_TABLE_MARKER ? state.eventRows : state.linkRows
        ),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: unknown) => {
        state.inserted = values;
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => ({
        where: vi.fn(async () => {
          state.updated = values;
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async (clause: unknown) => {
        state.deletedWhere = clause;
      }),
    })),
  };
});

vi.mock("@/lib/db", () => ({ getDb: () => dbMock }));

import { events } from "@/lib/db/schema";
import { createGoogleCalendarClient } from "@/lib/google/client";
import {
  getConnectionById,
  getConnectionForTrack,
  getValidAccessToken,
} from "./run";
import { pushEventCreated, pushEventDeleted, pushEventUpdated } from "./push";

// Matched against the `table` argument `db.select().from(table)` receives —
// `events` is imported above for identity comparison inside the hoisted mock,
// so this constant just documents which branch is which.
const EVENTS_TABLE_MARKER = events;

const connection = {
  id: "conn-1",
  track: "work" as const,
  googleCalendarId: "cal-1",
};

const fakeEvent = {
  id: "evt-1",
  track: "work",
  title: "Sprint planning",
  description: null,
  startsAt: new Date("2026-07-08T09:00:00Z"),
  endsAt: new Date("2026-07-08T10:00:00Z"),
  allDay: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.state.eventRows = [fakeEvent];
  dbMock.state.linkRows = [];
  dbMock.state.inserted = undefined;
  dbMock.state.updated = undefined;
  dbMock.state.deletedWhere = undefined;

  vi.mocked(getConnectionForTrack).mockResolvedValue(connection as never);
  vi.mocked(getConnectionById).mockResolvedValue(null);
  vi.mocked(getValidAccessToken).mockResolvedValue("access-token");
});

describe("pushEventCreated", () => {
  it("does nothing when the track has no connection", async () => {
    vi.mocked(getConnectionForTrack).mockResolvedValueOnce(null);
    const insertEvent = vi.fn();
    vi.mocked(createGoogleCalendarClient).mockReturnValue({
      insertEvent,
    } as never);

    await pushEventCreated("evt-1", "work");

    expect(insertEvent).not.toHaveBeenCalled();
  });

  it("inserts the event on Google and creates a synced link", async () => {
    const insertEvent = vi.fn().mockResolvedValue({
      id: "g-1",
      etag: '"e1"',
      updated: "2026-07-08T08:00:00Z",
    });
    vi.mocked(createGoogleCalendarClient).mockReturnValue({
      insertEvent,
    } as never);

    await pushEventCreated("evt-1", "work");

    expect(insertEvent).toHaveBeenCalledWith(
      "access-token",
      "cal-1",
      expect.objectContaining({ summary: "Sprint planning" })
    );
    expect(dbMock.state.inserted).toMatchObject({
      eventId: "evt-1",
      connectionId: "conn-1",
      googleEventId: "g-1",
      pushState: "synced",
    });
  });

  it("marks the link pending_push (with no google id yet) when the push fails", async () => {
    const insertEvent = vi.fn().mockRejectedValue(new Error("network error"));
    vi.mocked(createGoogleCalendarClient).mockReturnValue({
      insertEvent,
    } as never);

    await pushEventCreated("evt-1", "work");

    expect(dbMock.state.inserted).toMatchObject({
      eventId: "evt-1",
      googleEventId: null,
      pushState: "pending_push",
    });
  });
});

describe("pushEventUpdated", () => {
  it("becomes a create when the event has never been linked", async () => {
    const insertEvent = vi.fn().mockResolvedValue({
      id: "g-1",
      etag: '"e1"',
      updated: "2026-07-08T08:00:00Z",
    });
    vi.mocked(createGoogleCalendarClient).mockReturnValue({
      insertEvent,
    } as never);

    await pushEventUpdated("evt-1", "work");

    expect(insertEvent).toHaveBeenCalled();
  });

  it("patches the existing Google event when a link exists", async () => {
    dbMock.state.linkRows = [{ id: "link-1", googleEventId: "g-1" }];
    const patchEvent = vi.fn().mockResolvedValue({
      id: "g-1",
      etag: '"e2"',
      updated: "2026-07-08T09:00:00Z",
    });
    vi.mocked(createGoogleCalendarClient).mockReturnValue({
      patchEvent,
    } as never);

    await pushEventUpdated("evt-1", "work");

    expect(patchEvent).toHaveBeenCalledWith(
      "access-token",
      "cal-1",
      "g-1",
      expect.objectContaining({ summary: "Sprint planning" })
    );
    expect(dbMock.state.updated).toMatchObject({ pushState: "synced" });
  });

  it("marks pending_push on failure without touching the local event", async () => {
    dbMock.state.linkRows = [{ id: "link-1", googleEventId: "g-1" }];
    const patchEvent = vi.fn().mockRejectedValue(new Error("network error"));
    vi.mocked(createGoogleCalendarClient).mockReturnValue({
      patchEvent,
    } as never);

    await pushEventUpdated("evt-1", "work");

    expect(dbMock.state.updated).toEqual({ pushState: "pending_push" });
  });

  it("on a track flip, deletes from the old calendar and re-creates on the new one — never patches the old id onto the new calendar (issue #67)", async () => {
    // Event now lives on the `work` track, but its link still points at the
    // content calendar it was synced to before the flip.
    dbMock.state.linkRows = [
      { id: "link-1", googleEventId: "g-old", connectionId: "conn-content" },
    ];
    vi.mocked(getConnectionById).mockResolvedValue({
      id: "conn-content",
      track: "content",
      googleCalendarId: "cal-content",
    } as never);

    const deleteEvent = vi.fn().mockResolvedValue(undefined);
    const patchEvent = vi.fn();
    const insertEvent = vi.fn().mockResolvedValue({
      id: "g-new",
      etag: '"e-new"',
      updated: "2026-07-08T11:00:00Z",
    });
    vi.mocked(createGoogleCalendarClient).mockReturnValue({
      deleteEvent,
      patchEvent,
      insertEvent,
    } as never);

    await pushEventUpdated("evt-1", "work");

    // Removed from the OLD calendar with the OLD id...
    expect(deleteEvent).toHaveBeenCalledWith(
      "access-token",
      "cal-content",
      "g-old"
    );
    // ...created fresh on the NEW track's calendar...
    expect(insertEvent).toHaveBeenCalledWith(
      "access-token",
      "cal-1",
      expect.objectContaining({ summary: "Sprint planning" })
    );
    // ...and the old id is never patched onto the new calendar.
    expect(patchEvent).not.toHaveBeenCalled();
    expect(dbMock.state.updated).toMatchObject({
      connectionId: "conn-1",
      googleEventId: "g-new",
      pushState: "synced",
    });
  });

  it("on a track flip to an unconnected track, deletes the old copy and drops the link (issue #67)", async () => {
    dbMock.state.linkRows = [
      { id: "link-1", googleEventId: "g-old", connectionId: "conn-content" },
    ];
    vi.mocked(getConnectionById).mockResolvedValue({
      id: "conn-content",
      track: "content",
      googleCalendarId: "cal-content",
    } as never);
    // New track (work) isn't connected to any calendar.
    vi.mocked(getConnectionForTrack).mockResolvedValue(null);

    const deleteEvent = vi.fn().mockResolvedValue(undefined);
    const insertEvent = vi.fn();
    vi.mocked(createGoogleCalendarClient).mockReturnValue({
      deleteEvent,
      insertEvent,
    } as never);

    await pushEventUpdated("evt-1", "work");

    expect(deleteEvent).toHaveBeenCalledWith(
      "access-token",
      "cal-content",
      "g-old"
    );
    expect(insertEvent).not.toHaveBeenCalled();
    expect(dbMock.delete).toHaveBeenCalled();
  });
});

describe("pushEventDeleted", () => {
  it("just removes the link when it was never pushed to Google", async () => {
    const deleteEvent = vi.fn();
    vi.mocked(createGoogleCalendarClient).mockReturnValue({
      deleteEvent,
    } as never);

    await pushEventDeleted("link-1", null, "work");

    expect(deleteEvent).not.toHaveBeenCalled();
    expect(dbMock.delete).toHaveBeenCalled();
  });

  it("deletes on Google then removes the link", async () => {
    const deleteEvent = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createGoogleCalendarClient).mockReturnValue({
      deleteEvent,
    } as never);

    await pushEventDeleted("link-1", "g-1", "work");

    expect(deleteEvent).toHaveBeenCalledWith("access-token", "cal-1", "g-1");
    expect(dbMock.delete).toHaveBeenCalled();
  });

  it("tombstones the link as pending_delete when the Google delete fails", async () => {
    const deleteEvent = vi.fn().mockRejectedValue(new Error("network error"));
    vi.mocked(createGoogleCalendarClient).mockReturnValue({
      deleteEvent,
    } as never);

    await pushEventDeleted("link-1", "g-1", "work");

    expect(dbMock.state.updated).toEqual({ pushState: "pending_delete" });
  });
});
