import { endOfDay, startOfDay } from "date-fns";

import type { CalendarEvent } from "./types";

/** Whether an event's span touches the given calendar day at all. */
export function eventOverlapsDay(event: CalendarEvent, day: Date): boolean {
  return event.startsAt <= endOfDay(day) && event.endsAt >= startOfDay(day);
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
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  return {
    event,
    start: event.startsAt < dayStart ? dayStart : event.startsAt,
    end: event.endsAt > dayEnd ? dayEnd : event.endsAt,
  };
}

/** Minutes elapsed since local midnight, allowing fractional minutes for seconds precision. */
export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}
