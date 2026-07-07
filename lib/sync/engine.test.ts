import { format } from "date-fns";
import { describe, expect, it } from "vitest";

import type { GoogleEvent } from "@/lib/google/client";

import {
  fromGoogleAllDayEnd,
  fromGooglePayload,
  isOwnEcho,
  planInboundActions,
  resolveConflict,
  toGoogleAllDayEnd,
  toGooglePayload,
} from "./engine";
import type { LocalEventSnapshot, SyncLinkRecord } from "./types";

function googleEvent(overrides: Partial<GoogleEvent> = {}): GoogleEvent {
  return {
    id: "g-1",
    status: "confirmed",
    summary: "Sprint planning",
    description: "Weekly sync",
    start: { dateTime: "2026-07-08T09:00:00.000Z" },
    end: { dateTime: "2026-07-08T10:00:00.000Z" },
    updated: "2026-07-08T08:00:00.000Z",
    etag: '"etag-1"',
    ...overrides,
  };
}

function localEvent(
  overrides: Partial<LocalEventSnapshot> = {}
): LocalEventSnapshot {
  return {
    id: "local-1",
    track: "work",
    title: "Sprint planning",
    description: "Weekly sync",
    startsAt: new Date("2026-07-08T09:00:00.000Z"),
    endsAt: new Date("2026-07-08T10:00:00.000Z"),
    allDay: false,
    updatedAt: new Date("2026-07-08T08:00:00.000Z"),
    ...overrides,
  };
}

function link(overrides: Partial<SyncLinkRecord> = {}): SyncLinkRecord {
  return {
    id: "link-1",
    eventId: "local-1",
    googleEventId: "g-1",
    googleEtag: '"etag-0"',
    updatedAt: new Date("2026-07-08T08:00:00.000Z"),
    ...overrides,
  };
}

describe("all-day date boundary mapping", () => {
  it("adds one day converting our inclusive end to Google's exclusive end", () => {
    expect(toGoogleAllDayEnd(new Date("2026-07-08T00:00:00"))).toBe(
      "2026-07-09"
    );
  });

  it("subtracts one day converting Google's exclusive end back to our inclusive end", () => {
    const result = fromGoogleAllDayEnd("2026-07-09");
    expect(format(result, "yyyy-MM-dd")).toBe("2026-07-08");
  });

  it("round-trips a single-day all-day event (startsAt === endsAt)", () => {
    const start = new Date("2026-07-08T00:00:00");
    const googleEnd = toGoogleAllDayEnd(start);
    expect(fromGoogleAllDayEnd(googleEnd).getTime()).toBe(start.getTime());
  });
});

describe("toGooglePayload / fromGooglePayload", () => {
  it("maps a timed event both ways", () => {
    const event = localEvent();
    const payload = toGooglePayload(event);
    expect(payload.start).toEqual({ dateTime: event.startsAt.toISOString() });
    expect(payload.end).toEqual({ dateTime: event.endsAt.toISOString() });
    expect(payload.summary).toBe("Sprint planning");
  });

  it("maps an all-day event both ways, preserving the inclusive end date", () => {
    const event = localEvent({
      allDay: true,
      startsAt: new Date("2026-07-08T00:00:00"),
      endsAt: new Date("2026-07-08T00:00:00"),
    });
    const payload = toGooglePayload(event);
    expect(payload.start).toEqual({ date: "2026-07-08" });
    expect(payload.end).toEqual({ date: "2026-07-09" });

    const mapped = fromGooglePayload(
      googleEvent(payload as Partial<GoogleEvent>)
    );
    expect(mapped.allDay).toBe(true);
    expect(mapped.startsAt.getTime()).toBe(event.startsAt.getTime());
    expect(mapped.endsAt.getTime()).toBe(event.endsAt.getTime());
  });

  it("falls back to a placeholder title for an untitled Google event", () => {
    const mapped = fromGooglePayload(googleEvent({ summary: undefined }));
    expect(mapped.title).toBe("(untitled)");
  });

  it("maps a missing description to null", () => {
    const mapped = fromGooglePayload(googleEvent({ description: undefined }));
    expect(mapped.description).toBeNull();
  });
});

describe("isOwnEcho", () => {
  it("is true when the remote etag matches the link's recorded etag", () => {
    expect(
      isOwnEcho(googleEvent({ etag: '"same"' }), { googleEtag: '"same"' })
    ).toBe(true);
  });

  it("is false when the etags differ", () => {
    expect(
      isOwnEcho(googleEvent({ etag: '"new"' }), { googleEtag: '"old"' })
    ).toBe(false);
  });

  it("is false when the link has never recorded an etag", () => {
    expect(isOwnEcho(googleEvent(), { googleEtag: null })).toBe(false);
  });
});

describe("resolveConflict", () => {
  it("picks the remote side when Google's update is newer", () => {
    const local = localEvent({ updatedAt: new Date("2026-07-08T08:00:00Z") });
    const remote = googleEvent({ updated: "2026-07-08T09:00:00Z" });
    const result = resolveConflict(local, remote);
    expect(result.winner).toBe("remote");
    expect(result.note).toContain("Google Calendar");
  });

  it("picks the local side when the local edit is newer", () => {
    const local = localEvent({ updatedAt: new Date("2026-07-08T10:00:00Z") });
    const remote = googleEvent({ updated: "2026-07-08T09:00:00Z" });
    const result = resolveConflict(local, remote);
    expect(result.winner).toBe("local");
    expect(result.note).toContain("this app");
  });
});

describe("planInboundActions", () => {
  it("creates a local event for an unlinked remote event", () => {
    const [action] = planInboundActions({
      remoteEvents: [googleEvent()],
      linksByGoogleId: new Map(),
      localEventsById: new Map(),
    });
    expect(action.type).toBe("create-local");
    if (action.type === "create-local") {
      expect(action.input.title).toBe("Sprint planning");
      expect(action.remote.googleEventId).toBe("g-1");
    }
  });

  it("deletes the local event for a cancelled remote event with a link", () => {
    const [action] = planInboundActions({
      remoteEvents: [googleEvent({ status: "cancelled" })],
      linksByGoogleId: new Map([["g-1", link()]]),
      localEventsById: new Map([["local-1", localEvent()]]),
    });
    expect(action).toEqual({ type: "delete-local", eventId: "local-1" });
  });

  it("skips a cancelled remote event with no matching link", () => {
    const actions = planInboundActions({
      remoteEvents: [googleEvent({ status: "cancelled" })],
      linksByGoogleId: new Map(),
      localEventsById: new Map(),
    });
    expect(actions).toEqual([]);
  });

  it("skips its own echo", () => {
    const echoLink = link({ googleEtag: '"etag-1"' });
    const [action] = planInboundActions({
      remoteEvents: [googleEvent({ etag: '"etag-1"' })],
      linksByGoogleId: new Map([["g-1", echoLink]]),
      localEventsById: new Map([["local-1", localEvent()]]),
    });
    expect(action).toEqual({ type: "skip-echo", googleEventId: "g-1" });
  });

  it("updates the local event when the remote changed and there's no conflict", () => {
    const existingLink = link({ updatedAt: new Date("2026-07-08T08:00:00Z") });
    const local = localEvent({ updatedAt: new Date("2026-07-08T08:00:00Z") });
    const remote = googleEvent({
      etag: '"etag-new"',
      summary: "Sprint planning (rescheduled)",
      updated: "2026-07-08T09:00:00Z",
    });
    const [action] = planInboundActions({
      remoteEvents: [remote],
      linksByGoogleId: new Map([["g-1", existingLink]]),
      localEventsById: new Map([["local-1", local]]),
    });
    expect(action.type).toBe("update-local");
    if (action.type === "update-local") {
      expect(action.eventId).toBe("local-1");
      expect(action.input.title).toBe("Sprint planning (rescheduled)");
    }
  });

  it("re-creates the event when the link points at a local event that no longer exists", () => {
    const orphanLink = link({ eventId: "gone", googleEtag: '"etag-0"' });
    const [action] = planInboundActions({
      remoteEvents: [googleEvent({ etag: '"etag-new"' })],
      linksByGoogleId: new Map([["g-1", orphanLink]]),
      localEventsById: new Map(),
    });
    expect(action.type).toBe("create-local");
  });

  it("resolves in favor of remote when both sides changed and Google is newer", () => {
    const existingLink = link({ updatedAt: new Date("2026-07-08T07:00:00Z") });
    const local = localEvent({ updatedAt: new Date("2026-07-08T08:00:00Z") }); // after the link's last sync point
    const remote = googleEvent({
      etag: '"etag-new"',
      updated: "2026-07-08T09:00:00Z", // newer than local
    });
    const [action] = planInboundActions({
      remoteEvents: [remote],
      linksByGoogleId: new Map([["g-1", existingLink]]),
      localEventsById: new Map([["local-1", local]]),
    });
    expect(action.type).toBe("conflict-remote-wins");
    if (action.type === "conflict-remote-wins") {
      expect(action.eventId).toBe("local-1");
      expect(action.note).toContain("Google Calendar");
    }
  });

  it("resolves in favor of local when both sides changed and the local edit is newer", () => {
    const existingLink = link({ updatedAt: new Date("2026-07-08T07:00:00Z") });
    const local = localEvent({ updatedAt: new Date("2026-07-08T10:00:00Z") });
    const remote = googleEvent({
      etag: '"etag-new"',
      updated: "2026-07-08T09:00:00Z",
    });
    const [action] = planInboundActions({
      remoteEvents: [remote],
      linksByGoogleId: new Map([["g-1", existingLink]]),
      localEventsById: new Map([["local-1", local]]),
    });
    expect(action).toEqual({
      type: "conflict-local-wins",
      eventId: "local-1",
      googleEventId: "g-1",
      note: expect.stringContaining("this app"),
    });
  });

  it("processes multiple remote events into independent actions", () => {
    const actions = planInboundActions({
      remoteEvents: [
        googleEvent({ id: "g-1" }),
        googleEvent({ id: "g-2", status: "cancelled" }),
      ],
      linksByGoogleId: new Map([["g-2", link({ googleEventId: "g-2" })]]),
      localEventsById: new Map([["local-1", localEvent()]]),
    });
    expect(actions).toHaveLength(2);
    expect(actions[0].type).toBe("create-local");
    expect(actions[1]).toEqual({ type: "delete-local", eventId: "local-1" });
  });
});
