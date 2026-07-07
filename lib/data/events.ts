import "server-only";
import { and, asc, gte, lt } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";
import type { CalendarEvent } from "@/lib/calendar/types";

/**
 * Events overlapping `[from, to)` — anything whose span touches the range,
 * not just events that start inside it (needed for multi-day events).
 * `endsAt` uses `gte`, not `gt`: a single-day all-day event stores
 * `startsAt === endsAt` at that day's midnight, which must still match the
 * day's own `[from, to)` range where `endsAt === from`.
 */
export async function getEventsInRange(
  from: Date,
  to: Date
): Promise<CalendarEvent[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(events)
    .where(and(lt(events.startsAt, to), gte(events.endsAt, from)))
    .orderBy(asc(events.startsAt));

  return rows.map((row) => ({
    id: row.id,
    track: row.track,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
  }));
}
