import "server-only";
import { and, asc, eq, gte, lt, or } from "drizzle-orm";
import { startOfDay } from "date-fns";

import { getDb } from "@/lib/db";
import { eventSyncLinks, events } from "@/lib/db/schema";
import type { CalendarEvent } from "@/lib/calendar/types";
import { getLinkedIdeaSummariesForEvents } from "@/lib/data/idea-event-links";

/**
 * Events overlapping `[from, to)` — anything whose span touches the range,
 * not just events that start inside it (needed for multi-day events).
 * `endsAt` uses `gte`, not `gt`: a single-day all-day event stores
 * `startsAt === endsAt` at that day's midnight, which must still match the
 * day's own `[from, to)` range where `endsAt === from`.
 *
 * Left-joins `event_sync_links` for `conflictNote` (issue #12 — see
 * docs/google-sync.md): most events have no sync link at all, hence the
 * left join rather than requiring one.
 */
export async function getEventsInRange(
  from: Date,
  to: Date
): Promise<CalendarEvent[]> {
  const db = getDb();
  const rows = await db
    .select({ event: events, conflictNote: eventSyncLinks.conflictNote })
    .from(events)
    .leftJoin(eventSyncLinks, eq(eventSyncLinks.eventId, events.id))
    .where(and(lt(events.startsAt, to), gte(events.endsAt, from)))
    .orderBy(asc(events.startsAt));

  const linkedIdeasByEvent = await getLinkedIdeaSummariesForEvents(
    rows.map(({ event: row }) => row.id)
  );

  return rows.map(({ event: row, conflictNote }) => ({
    id: row.id,
    track: row.track,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
    conflictNote: conflictNote ?? null,
    linkedIdeas: linkedIdeasByEvent.get(row.id) ?? [],
  }));
}

/**
 * Events starting before `horizonEnd` that haven't ended yet — the source
 * data for the upcoming-agenda widget (issue #14). "Hasn't ended" differs by
 * kind: a timed event needs `endsAt >= now`, but an all-day event stores
 * `startsAt`/`endsAt` as day boundaries (docs/calendar.md), so using `now`
 * there would drop today's all-day events the moment the clock passes
 * midnight; `endsAt >= startOfDay(now)` is the equivalent check for them.
 * In-progress events are intentionally included — see `lib/calendar/agenda.ts`.
 */
export async function getUpcomingEvents(
  now: Date,
  horizonEnd: Date
): Promise<CalendarEvent[]> {
  const db = getDb();
  const todayStart = startOfDay(now);
  const rows = await db
    .select({ event: events, conflictNote: eventSyncLinks.conflictNote })
    .from(events)
    .leftJoin(eventSyncLinks, eq(eventSyncLinks.eventId, events.id))
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

  return rows.map(({ event: row, conflictNote }) => ({
    id: row.id,
    track: row.track,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
    conflictNote: conflictNote ?? null,
    linkedIdeas: linkedIdeasByEvent.get(row.id) ?? [],
  }));
}
