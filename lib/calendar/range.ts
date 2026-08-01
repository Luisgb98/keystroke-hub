import {
  appAddDays,
  appAddMonths,
  appAddWeeks,
  appIsSameMonth,
  appIsSameYear,
  appStartOfDay,
  appStartOfMonth,
  appStartOfWeek,
  formatAppDateParam,
  formatInAppZone,
  parseAppDate,
} from "@/lib/time";

import type { CalendarView } from "./types";

export interface DateRange {
  /** Inclusive start of the visible period. */
  from: Date;
  /** Exclusive end of the visible period. */
  to: Date;
}

/**
 * Every boundary here is computed in the app timezone rather than the
 * renderer's (see lib/time): on Vercel's UTC servers a plain `startOfDay`
 * would put a 00:30 Madrid event on the previous day and start the week on
 * the wrong boundary (issue #95).
 */

/**
 * The range to query/render for a given view anchored at `date`. `to` is
 * exclusive, so callers can query events with `startsAt < to && endsAt > from`.
 */
export function getVisibleRange(view: CalendarView, date: Date): DateRange {
  switch (view) {
    case "day": {
      const from = appStartOfDay(date);
      return { from, to: appAddDays(from, 1) };
    }
    case "week": {
      const from = appStartOfWeek(date);
      return { from, to: appAddWeeks(from, 1) };
    }
    case "month": {
      const from = getMonthGridStart(date);
      return { from, to: appAddDays(from, 42) };
    }
  }
}

function getMonthGridStart(date: Date): Date {
  return appStartOfWeek(appStartOfMonth(date));
}

/** The 42 (6 x 7) days shown in month view, Monday-start, possibly spilling into adjacent months. */
export function getMonthGridDays(date: Date): Date[] {
  const gridStart = getMonthGridStart(date);
  return Array.from({ length: 42 }, (_, i) => appAddDays(gridStart, i));
}

/** The 7 days shown in week view, Monday-start. */
export function getWeekDays(date: Date): Date[] {
  const weekStart = appStartOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => appAddDays(weekStart, i));
}

/** Moves `date` to the previous/next period for `view`, for prev/next navigation. */
export function shiftDate(
  view: CalendarView,
  date: Date,
  direction: -1 | 1
): Date {
  switch (view) {
    case "day":
      return appAddDays(date, direction);
    case "week":
      return appAddWeeks(date, direction);
    case "month":
      // Normalize to the 1st so repeated shifts don't drift across
      // months of different lengths (e.g. Jan 31 -> Feb 28 -> Mar 28).
      return appAddMonths(appStartOfMonth(date), direction);
  }
}

/** Human-readable label for the calendar header. */
export function formatRangeLabel(view: CalendarView, date: Date): string {
  switch (view) {
    case "day":
      return formatInAppZone(date, "EEEE, MMMM d, yyyy");
    case "week": {
      const [start, end] = [getWeekDays(date)[0], getWeekDays(date)[6]];
      if (!appIsSameYear(start, end)) {
        return `${formatInAppZone(start, "MMM d, yyyy")} – ${formatInAppZone(end, "MMM d, yyyy")}`;
      }
      if (!appIsSameMonth(start, end)) {
        return `${formatInAppZone(start, "MMM d")} – ${formatInAppZone(end, "MMM d, yyyy")}`;
      }
      return `${formatInAppZone(start, "MMM d")}–${formatInAppZone(end, "d, yyyy")}`;
    }
    case "month":
      return formatInAppZone(appStartOfMonth(date), "MMMM yyyy");
  }
}

/** Formats a Date as the `YYYY-MM-DD` value used in the `?date=` URL param. */
export function formatDateParam(date: Date): string {
  return formatAppDateParam(date);
}

/** Parses a `?date=` URL param, falling back to today for missing/invalid values. */
export function parseDateParam(value: string | undefined): Date {
  if (value) {
    const parsed = parseAppDate(value);
    if (parsed) return parsed;
  }
  return appStartOfDay(new Date());
}

/** Parses a `?view=` URL param, falling back to `week` for missing/invalid values. */
export function parseViewParam(value: string | undefined): CalendarView {
  if (value === "day" || value === "week" || value === "month") return value;
  return "week";
}
