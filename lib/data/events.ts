import "server-only";
import { and, asc, eq, gte, lt, or } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { eventSyncLinks, events, streams } from "@/lib/db/schema";
import type { CalendarEvent } from "@/lib/calendar/types";
import { getLinkedIdeaSummariesForEvents } from "@/lib/data/idea-event-links";
import { appStartOfDay } from "@/lib/time";

/**
 * Events overlapping `[from, to)` — anything whose span touches the range,
 * not just events that start inside it (needed for multi-day events).
 * `endsAt` uses `gte`, not `gt`: a single-day all-day event stores
 * `startsAt === endsAt` at that day's midnight, which must still match the
 * day's own `[from, to)` range where `endsAt === from`.
 *
 * Left-joins `event_sync_links` for `conflictNote` (issue #12 — see
 * docs/google-sync.md) and `streams` for `streamId` (issue #104 — a
 * content-track event with a session behind it renders as a Stream block):
 * most events have neither, hence left joins rather than requiring one.
 */
export async function getEventsInRange(
  from: Date,
  to: Date
): Promise<CalendarEvent[]> {
  const db = getDb();
  const rows = await db
    .select({
      event: events,
      conflictNote: eventSyncLinks.conflictNote,
      streamId: streams.id,
    })
    .from(events)
    .leftJoin(eventSyncLinks, eq(eventSyncLinks.eventId, events.id))
    .leftJoin(streams, eq(streams.eventId, events.id))
    .where(and(lt(events.startsAt, to), gte(events.endsAt, from)))
    .orderBy(asc(events.startsAt));

  const linkedIdeasByEvent = await getLinkedIdeaSummariesForEvents(
    rows.map(({ event: row }) => row.id)
  );

  return rows.map(({ event: row, conflictNote, streamId }) => ({
    id: row.id,
    track: row.track,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
    conflictNote: conflictNote ?? null,
    linkedIdeas: linkedIdeasByEvent.get(row.id) ?? [],
    streamId,
  }));
}

/**
 * Events starting before `horizonEnd` that haven't ended yet — the source
 * data for the upcoming-agenda widget (issue #14). "Hasn't ended" differs by
 * kind: a timed event needs `endsAt >= now`, but an all-day event stores
 * `startsAt`/`endsAt` as day boundaries (docs/calendar.md), so using `now`
 * there would drop today's all-day events the moment the clock passes
 * midnight; `endsAt >= appStartOfDay(now)` is the equivalent check for them.
 * That boundary is the app timezone's, matching how the rows were written
 * (see lib/time).
 * In-progress events are intentionally included — see `lib/calendar/agenda.ts`.
 */
export async function getUpcomingEvents(
  now: Date,
  horizonEnd: Date
): Promise<CalendarEvent[]> {
  const db = getDb();
  const todayStart = appStartOfDay(now);
  const rows = await db
    .select({
      event: events,
      conflictNote: eventSyncLinks.conflictNote,
      streamId: streams.id,
    })
    .from(events)
    .leftJoin(eventSyncLinks, eq(eventSyncLinks.eventId, events.id))
    .leftJoin(streams, eq(streams.eventId, events.id))
    .where(
      and(
        lt(events.startsAt, horizonEnd),
        or(
          and(eq(events.allDay, false), gte(events.endsAt, now)),
          and(eq(events.allDay, true), gte(events.endsAt, todayStart))
        )
      )
    )
    .orderBy(asc(events.startsAt));

  const linkedIdeasByEvent = await getLinkedIdeaSummariesForEvents(
    rows.map(({ event: row }) => row.id)
  );

  return rows.map(({ event: row, conflictNote, streamId }) => ({
    id: row.id,
    track: row.track,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
    conflictNote: conflictNote ?? null,
    linkedIdeas: linkedIdeasByEvent.get(row.id) ?? [],
    streamId,
  }));
}

/**
 * One event by id, with just enough to decide what may touch it: its track
 * (the work/content boundary the MCP tools enforce — issue #109) and whether a
 * stream session schedules it.
 */
export async function getEventById(id: string): Promise<{
  id: string;
  track: CalendarEvent["track"];
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  streamId: string | null;
} | null> {
  const db = getDb();
  const [row] = await db
    .select({ event: events, streamId: streams.id })
    .from(events)
    .leftJoin(streams, eq(streams.eventId, events.id))
    .where(eq(events.id, id));

  if (!row) return null;
  return {
    id: row.event.id,
    track: row.event.track,
    title: row.event.title,
    description: row.event.description,
    startsAt: row.event.startsAt,
    endsAt: row.event.endsAt,
    allDay: row.event.allDay,
    streamId: row.streamId,
  };
}
