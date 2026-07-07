import { addDays, format, subDays } from "date-fns";

import type { GoogleEvent } from "@/lib/google/client";

import type {
  LocalEventSnapshot,
  MappedEventInput,
  RemoteStamp,
  SyncAction,
  SyncLinkRecord,
} from "./types";

/**
 * Pure sync core — every diff/merge/conflict/echo/payload-mapping decision
 * lives here as dependency-free functions, with no db or network access, so
 * it's directly unit-testable the way `lib/calendar/{range,segments,layout}.ts`
 * are. `lib/sync/run.ts` is the only caller and does the actual I/O.
 */

const DATE_ONLY = "yyyy-MM-dd";

/**
 * App events store an *inclusive* last day for multi-day all-day events
 * (`startsAt === endsAt` for a single day, see docs/calendar.md); Google's
 * all-day `end.date` is *exclusive* (the day after the last day). Every
 * all-day boundary crosses this +/-1 day translation.
 */
export function toGoogleAllDayEnd(endsAt: Date): string {
  return format(addDays(endsAt, 1), DATE_ONLY);
}

export function fromGoogleAllDayEnd(endDate: string): Date {
  return subDays(new Date(`${endDate}T00:00:00`), 1);
}

export function toGooglePayload(
  event: Pick<
    MappedEventInput,
    "title" | "description" | "allDay" | "startsAt" | "endsAt"
  >
): Partial<GoogleEvent> {
  if (event.allDay) {
    return {
      summary: event.title,
      description: event.description ?? undefined,
      start: { date: format(event.startsAt, DATE_ONLY) },
      end: { date: toGoogleAllDayEnd(event.endsAt) },
    };
  }
  return {
    summary: event.title,
    description: event.description ?? undefined,
    start: { dateTime: event.startsAt.toISOString() },
    end: { dateTime: event.endsAt.toISOString() },
  };
}

export function fromGooglePayload(google: GoogleEvent): MappedEventInput {
  const allDay = Boolean(google.start.date);
  const startsAt = allDay
    ? new Date(`${google.start.date}T00:00:00`)
    : new Date(google.start.dateTime!);
  const endsAt = allDay
    ? fromGoogleAllDayEnd(google.end.date!)
    : new Date(google.end.dateTime!);

  return {
    title: google.summary?.trim() || "(untitled)",
    description: google.description ?? null,
    allDay,
    startsAt,
    endsAt,
  };
}

/**
 * An inbound delta is our own echo when its etag matches what we recorded
 * on the link after our last outbound push — Google always changes the
 * etag on write, so a match can only mean we're seeing our own change
 * reflected back through the sync token, not an edit from the other side.
 */
export function isOwnEcho(
  remote: Pick<GoogleEvent, "etag">,
  link: Pick<SyncLinkRecord, "googleEtag">
): boolean {
  return link.googleEtag !== null && link.googleEtag === remote.etag;
}

/**
 * True conflict: the local event changed *after* the link was last written
 * by our side (i.e. after the last successful push or pull), so this
 * inbound remote change and a local edit happened independently.
 */
function isConflict(local: LocalEventSnapshot, link: SyncLinkRecord): boolean {
  return local.updatedAt.getTime() > link.updatedAt.getTime();
}

/** Latest-edit-wins conflict resolution — predictable and visible per the acceptance criteria. */
export function resolveConflict(
  local: LocalEventSnapshot,
  remote: GoogleEvent
): { winner: "local" | "remote"; note: string } {
  const remoteUpdated = new Date(remote.updated);
  const now = new Date().toLocaleString();

  if (remoteUpdated.getTime() > local.updatedAt.getTime()) {
    return {
      winner: "remote",
      note: `Conflicting edit resolved in favor of Google Calendar on ${now} — your local change to "${local.title}" was overwritten.`,
    };
  }
  return {
    winner: "local",
    note: `Conflicting edit resolved in favor of this app on ${now} — the Google Calendar change to "${local.title}" was overwritten.`,
  };
}

export interface PlanInboundActionsArgs {
  remoteEvents: GoogleEvent[];
  /** Keyed by `googleEventId`. */
  linksByGoogleId: Map<string, SyncLinkRecord>;
  /** Keyed by local event id. */
  localEventsById: Map<string, LocalEventSnapshot>;
}

/**
 * Turns a page of remote deltas into a list of local actions to apply.
 * Google reports deletions as `status: "cancelled"` entries in the delta
 * (see docs/google-sync.md); recurring event instances arrive pre-expanded
 * (the client requests `singleEvents=true`), so each is handled like any
 * other standalone event — no separate recurrence-expansion logic needed.
 */
export function planInboundActions({
  remoteEvents,
  linksByGoogleId,
  localEventsById,
}: PlanInboundActionsArgs): SyncAction[] {
  const actions: SyncAction[] = [];

  for (const remote of remoteEvents) {
    const link = linksByGoogleId.get(remote.id);
    const remoteStamp: RemoteStamp = {
      googleEventId: remote.id,
      googleEtag: remote.etag,
      googleUpdatedAt: new Date(remote.updated),
    };

    if (remote.status === "cancelled") {
      if (link?.eventId) {
        actions.push({ type: "delete-local", eventId: link.eventId });
      }
      continue;
    }

    if (!link) {
      actions.push({
        type: "create-local",
        input: fromGooglePayload(remote),
        remote: remoteStamp,
      });
      continue;
    }

    if (isOwnEcho(remote, link)) {
      actions.push({ type: "skip-echo", googleEventId: remote.id });
      continue;
    }

    const local = link.eventId ? localEventsById.get(link.eventId) : undefined;

    if (!local) {
      // Link points at an event that no longer exists locally (e.g. deleted
      // out from under us between sync runs) — nothing sane to conflict
      // against, so the inbound side just wins and re-creates it.
      actions.push({
        type: "create-local",
        input: fromGooglePayload(remote),
        remote: remoteStamp,
      });
      continue;
    }

    if (isConflict(local, link)) {
      const { winner, note } = resolveConflict(local, remote);
      actions.push(
        winner === "remote"
          ? {
              type: "conflict-remote-wins",
              eventId: local.id,
              input: fromGooglePayload(remote),
              remote: remoteStamp,
              note,
            }
          : {
              type: "conflict-local-wins",
              eventId: local.id,
              googleEventId: remote.id,
              note,
            }
      );
      continue;
    }

    actions.push({
      type: "update-local",
      eventId: local.id,
      input: fromGooglePayload(remote),
      remote: remoteStamp,
    });
  }

  return actions;
}
