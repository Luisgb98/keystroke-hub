import { describe, expect, it } from "vitest";

import type { GoogleEvent } from "@/lib/google/client";
import { formatAppDateParam, parseAppDate } from "@/lib/time";

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

/**
 * All-day boundaries are app-zone midnight instants (see lib/time), and this
 * suite runs under `TZ=UTC` — so `new Date("2026-07-08T00:00:00")` is *not*
 * the app's 2026-07-08 and would make the round-trip assertions vacuous (#95).
 */
function appMidnight(value: string): Date {
  const parsed = parseAppDate(value);
  if (!parsed) throw new Error(`bad test fixture: ${value}`);
  return parsed;
}

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
    pushState: "synced",
    ...overrides,
  };
}

describe("all-day date boundary mapping", () => {
  it("adds one day converting our inclusive end to Google's exclusive end", () => {
    expect(toGoogleAllDayEnd(appMidnight("2026-07-08"))).toBe("2026-07-09");
  });

  it("subtracts one day converting Google's exclusive end back to our inclusive end", () => {
    const result = fromGoogleAllDayEnd("2026-07-09");
    expect(formatAppDateParam(result)).toBe("2026-07-08");
    // Madrid is UTC+2 in July, so the inclusive end really is 22:00Z prior.
    expect(result.toISOString()).toBe("2026-07-07T22:00:00.000Z");
  });

  it("round-trips a single-day all-day event (startsAt === endsAt)", () => {
    const start = appMidnight("2026-07-08");
    const googleEnd = toGoogleAllDayEnd(start);
    expect(fromGoogleAllDayEnd(googleEnd).getTime()).toBe(start.getTime());
  });

  it("round-trips every day of the year without drifting (no phantom diffs)", () => {
    // A parse/format pair that disagreed by a day would make every all-day
    // event look changed on every sync run (issue #95).
    const drifted: string[] = [];
    for (let i = 0; i < 365; i++) {
      const day = formatAppDateParam(
        new Date(Date.UTC(2026, 0, 1, 12) + i * 86_400_000)
      );
      const start = appMidnight(day);
      const back = fromGoogleAllDayEnd(toGoogleAllDayEnd(start));
      if (back.getTime() !== start.getTime()) drifted.push(day);
    }
    expect(drifted).toEqual([]);
  });

  it("keeps Google's own all-day strings stable through a full push/pull cycle", () => {
    // Both DST changeover days are in here: a parse/format pair that
    // disagreed across an offset change would come back a day off.
    const cases: [start: string, exclusiveEnd: string][] = [
      ["2026-01-15", "2026-01-16"],
      ["2026-03-28", "2026-03-30"], // spans the spring-forward day
      ["2026-08-01", "2026-08-02"],
      ["2026-10-24", "2026-10-26"], // spans the fall-back day
    ];

    for (const [start, exclusiveEnd] of cases) {
      const pulled = fromGooglePayload(
        googleEvent({
          start: { date: start },
          end: { date: exclusiveEnd },
        } as Partial<GoogleEvent>)
      );
      expect(pulled.allDay).toBe(true);
      // Pushing straight back must reproduce Google's own strings verbatim —
      // anything else is a diff Google would see on every sync run.
      const payload = toGooglePayload(pulled);
      expect(payload.start).toEqual({ date: start });
      expect(payload.end).toEqual({ date: exclusiveEnd });
    }
  });

  it("throws rather than storing an Invalid Date for an unparseable Google date", () => {
    expect(() => fromGoogleAllDayEnd("2026-02-30")).toThrow(/unparseable/);
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
      startsAt: appMidnight("2026-07-08"),
      endsAt: appMidnight("2026-07-08"),
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

  it("does not resurrect a locally-deleted event whose delete push is still pending (issue #67)", () => {
    // Link's `eventId` was nulled by the local delete (ON DELETE SET NULL) and
    // its Google delete hasn't been pushed yet, so the remote copy is still
    // live. Re-creating it here would resurrect what the owner just deleted.
    const deletedLink = link({
      eventId: null,
      googleEtag: '"etag-0"',
      pushState: "pending_delete",
    });
    const [action] = planInboundActions({
      remoteEvents: [googleEvent({ etag: '"etag-new"' })],
      linksByGoogleId: new Map([["g-1", deletedLink]]),
      localEventsById: new Map(),
    });
    expect(action).toEqual({ type: "skip-echo", googleEventId: "g-1" });
  });

  it("does not resurrect when a stale in-memory eventId points at an already-deleted event (issue #67)", () => {
    // TOCTOU: the link still carries a non-null eventId in memory, but the
    // event row was deleted mid-run, so no local snapshot exists for it.
    const staleLink = link({ eventId: "gone", googleEtag: '"etag-0"' });
    const [action] = planInboundActions({
      remoteEvents: [googleEvent({ etag: '"etag-new"' })],
      linksByGoogleId: new Map([["g-1", staleLink]]),
      localEventsById: new Map(),
    });
    expect(action).toEqual({ type: "skip-echo", googleEventId: "g-1" });
  });

  it("treats a remote change against a pending local push as a conflict, never a silent overwrite (issue #67)", () => {
    // The local edit's push failed (pending_push) and that failure already
    // bumped the link's updatedAt past the local edit, so isConflict alone
    // would see no divergence and silently update-local, losing the edit.
    const pendingLink = link({
      googleEtag: '"etag-0"',
      pushState: "pending_push",
      updatedAt: new Date("2026-07-08T12:00:00.000Z"), // bumped by the failed push
    });
    const local = localEvent({
      updatedAt: new Date("2026-07-08T10:00:00.000Z"), // the un-pushed edit
    });
    const remote = googleEvent({
      etag: '"etag-new"',
      summary: "Remote edit",
      updated: "2026-07-08T13:00:00.000Z", // newer than the local edit
    });
    const [action] = planInboundActions({
      remoteEvents: [remote],
      linksByGoogleId: new Map([["g-1", pendingLink]]),
      localEventsById: new Map([["local-1", local]]),
    });
    expect(action.type).toBe("conflict-remote-wins");
    if (action.type === "conflict-remote-wins") {
      expect(action.note).toContain("Google Calendar");
    }
  });

  it("keeps a pending local push retryable when the remote hasn't changed (own echo)", () => {
    // Remote etag still matches the link (our failed push never changed it),
    // so this is a no-op echo — the pending push must survive for the cron to
    // retry, not be cancelled by an update-local.
    const pendingLink = link({
      googleEtag: '"etag-1"',
      pushState: "pending_push",
    });
    const [action] = planInboundActions({
      remoteEvents: [googleEvent({ etag: '"etag-1"' })],
      linksByGoogleId: new Map([["g-1", pendingLink]]),
      localEventsById: new Map([["local-1", localEvent()]]),
    });
    expect(action).toEqual({ type: "skip-echo", googleEventId: "g-1" });
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
