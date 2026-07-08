import { addDays, format, isSameDay, startOfDay } from "date-fns";

import { eventOverlapsDay } from "./segments";
import type { CalendarEvent } from "./types";

/** Today + tomorrow — the fixed horizon for the upcoming-agenda widget (issue #14). */
export const AGENDA_HORIZON_DAYS = 2;

/** Default cap on the total number of rows the agenda widget renders. */
export const DEFAULT_AGENDA_MAX_ITEMS = 8;

export interface AgendaItem {
  event: CalendarEvent;
  /** "Now" while in progress, "All day" for all-day events, else a "HH:mm" start time. */
  timeLabel: string;
  inProgress: boolean;
}

export interface AgendaDayGroup {
  /** Stable per-day key (`yyyy-MM-dd`). */
  key: string;
  /** "Today" / "Tomorrow" — the only two labels the fixed horizon ever produces. */
  label: string;
  items: AgendaItem[];
}

/**
 * Whether an event has finished as of `now`. An all-day event is date-scoped
 * (docs/calendar.md), so it's only "over" once its day has fully passed —
 * comparing against `now` directly would drop it the instant the clock
 * passes midnight on its own day. A timed event uses a strict `<=`: one that
 * ends exactly at `now` has just finished and isn't "upcoming" anymore.
 */
function isEventOver(event: CalendarEvent, now: Date): boolean {
  return event.allDay ? event.endsAt < startOfDay(now) : event.endsAt <= now;
}

function isInProgress(event: CalendarEvent, now: Date): boolean {
  return !event.allDay && event.startsAt <= now && event.endsAt > now;
}

function timeLabelFor(event: CalendarEvent, now: Date): string {
  if (event.allDay) return "All day";
  if (isInProgress(event, now)) return "Now";
  return format(event.startsAt, "HH:mm");
}

/**
 * Groups upcoming events into day buckets ("Today"/"Tomorrow") for the
 * agenda widget: within a day, all-day items are pinned before timed ones
 * (matching the calendar's own convention), and the whole agenda is capped
 * at `maxItems` rows. A multi-day all-day event appears once per day bucket
 * it covers within the horizon, mirroring the calendar's segment behavior
 * (docs/calendar.md) rather than collapsing to a single row.
 */
export function buildAgenda(
  events: CalendarEvent[],
  now: Date,
  maxItems: number = DEFAULT_AGENDA_MAX_ITEMS
): AgendaDayGroup[] {
  const todayStart = startOfDay(now);
  const active = events.filter((event) => !isEventOver(event, now));

  const groups: AgendaDayGroup[] = [];
  let remaining = maxItems;

  for (let i = 0; i < AGENDA_HORIZON_DAYS && remaining > 0; i++) {
    const day = addDays(todayStart, i);
    const dayEvents = active
      .filter((event) => eventOverlapsDay(event, day))
      .sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return a.startsAt.getTime() - b.startsAt.getTime();
      });

    if (dayEvents.length === 0) continue;

    const items: AgendaItem[] = dayEvents.slice(0, remaining).map((event) => ({
      event,
      timeLabel: timeLabelFor(event, now),
      inProgress: isInProgress(event, now),
    }));
    remaining -= items.length;

    groups.push({
      key: format(day, "yyyy-MM-dd"),
      label: isSameDay(day, todayStart) ? "Today" : "Tomorrow",
      items,
    });
  }

  return groups;
}
