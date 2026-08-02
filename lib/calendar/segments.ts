import {
  appEndOfDay,
  appMinutesSinceMidnight,
  appStartOfDay,
} from "@/lib/time";

import type { CalendarEvent } from "./types";

/**
 * Day boundaries are the app timezone's, not the renderer's (see lib/time) —
 * these run inside SSR'd client components, so a server pass in UTC and a
 * browser pass in Madrid have to agree on where a day starts (issue #95).
 */

/** Whether an event's span touches the given calendar day at all. */
export function eventOverlapsDay(event: CalendarEvent, day: Date): boolean {
  return (
    event.startsAt <= appEndOfDay(day) && event.endsAt >= appStartOfDay(day)
  );
}

export interface DaySegment {
  event: CalendarEvent;
  /** Event start, clamped to the given day's boundaries. */
  start: Date;
  /** Event end, clamped to the given day's boundaries. */
  end: Date;
}

/** Clamps a (possibly multi-day) timed event to the portion visible within `day`. */
export function clampEventToDay(event: CalendarEvent, day: Date): DaySegment {
  const dayStart = appStartOfDay(day);
  const dayEnd = appEndOfDay(day);
  return {
    event,
    start: event.startsAt < dayStart ? dayStart : event.startsAt,
    end: event.endsAt > dayEnd ? dayEnd : event.endsAt,
  };
}

/** Minutes elapsed since app-timezone midnight, allowing fractional minutes for seconds precision. */
export function minutesSinceMidnight(date: Date): number {
  return appMinutesSinceMidnight(date);
}
