import { addDays, addMinutes } from "date-fns";

import type { CalendarEvent } from "./types";

/** Move/resize snap granularity, matching Google Calendar's default. */
export const DRAG_SNAP_MINUTES = 15;
/** An event can never be resized shorter than one snap step. */
export const MIN_EVENT_DURATION_MINUTES = DRAG_SNAP_MINUTES;
/** Pointer movement (px) below this is a click/tap, not a drag. */
export const DRAG_THRESHOLD_PX = 5;
/** Touch hold time before a drag engages, so a scroll swipe isn't mistaken for a lift. */
export const LONG_PRESS_MS = 350;

export interface TimeShift {
  startsAt: Date;
  endsAt: Date;
}

type TimedEvent = Pick<CalendarEvent, "startsAt" | "endsAt">;

/** Rounds a minute offset to the nearest snap step (can be negative). */
export function snapMinutes(
  minutes: number,
  step: number = DRAG_SNAP_MINUTES
): number {
  // `|| 0` normalizes a `-0` result (e.g. snapMinutes(-7)) to plain `0`.
  return Math.round(minutes / step) * step || 0;
}

/** Converts a pixel delta to minutes given the grid's measured px-per-hour. */
export function pxToMinutes(px: number, pxPerHour: number): number {
  return (px / pxPerHour) * 60;
}

/**
 * Moves a timed event by a whole-day offset plus a snapped minute offset
 * within the day, preserving duration. Used for day/week time-grid drags.
 */
export function moveEvent(
  event: TimedEvent,
  deltaDays: number,
  deltaMinutes: number
): TimeShift {
  const durationMs = event.endsAt.getTime() - event.startsAt.getTime();
  const startsAt = addMinutes(
    addDays(event.startsAt, deltaDays),
    snapMinutes(deltaMinutes)
  );
  return { startsAt, endsAt: new Date(startsAt.getTime() + durationMs) };
}

/**
 * Shifts an event by whole days only, time-of-day preserved untouched. Used
 * for month-cell and all-day chip drags, which have no time-of-day axis.
 */
export function moveEventByDays(
  event: TimedEvent,
  deltaDays: number
): TimeShift {
  return {
    startsAt: addDays(event.startsAt, deltaDays),
    endsAt: addDays(event.endsAt, deltaDays),
  };
}

export type ResizeEdge = "start" | "end";

/**
 * Resizes a timed event from one edge by a snapped minute delta. The edge
 * can never cross the opposite edge closer than `MIN_EVENT_DURATION_MINUTES`.
 */
export function resizeEvent(
  event: TimedEvent,
  edge: ResizeEdge,
  deltaMinutes: number
): TimeShift {
  const snapped = snapMinutes(deltaMinutes);

  if (edge === "start") {
    const latestStart = addMinutes(event.endsAt, -MIN_EVENT_DURATION_MINUTES);
    let startsAt = addMinutes(event.startsAt, snapped);
    if (startsAt.getTime() > latestStart.getTime()) startsAt = latestStart;
    return { startsAt, endsAt: event.endsAt };
  }

  const earliestEnd = addMinutes(event.startsAt, MIN_EVENT_DURATION_MINUTES);
  let endsAt = addMinutes(event.endsAt, snapped);
  if (endsAt.getTime() < earliestEnd.getTime()) endsAt = earliestEnd;
  return { startsAt: event.startsAt, endsAt };
}

/** Whether a shift is a no-op (dropped back at its origin) — no call, no toast. */
export function isNoopShift(event: TimedEvent, shift: TimeShift): boolean {
  return (
    shift.startsAt.getTime() === event.startsAt.getTime() &&
    shift.endsAt.getTime() === event.endsAt.getTime()
  );
}
