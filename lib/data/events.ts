import "server-only";
import { and, asc, eq, gte, lt } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { eventSyncLinks, events } from "@/lib/db/schema";
import type { CalendarEvent } from "@/lib/calendar/types";

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

  return rows.map(({ event: row, conflictNote }) => ({
    id: row.id,
    track: row.track,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
    conflictNote: conflictNote ?? null,
  }));
}
