import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isSameMonth,
  isSameYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import type { CalendarView } from "./types";

/** Calendar weeks start on Monday throughout the app. */
const WEEK_STARTS_ON = 1;

export interface DateRange {
  /** Inclusive start of the visible period. */
  from: Date;
  /** Exclusive end of the visible period. */
  to: Date;
}

/**
 * The range to query/render for a given view anchored at `date`. `to` is
 * exclusive, so callers can query events with `startsAt < to && endsAt > from`.
 */
export function getVisibleRange(view: CalendarView, date: Date): DateRange {
  switch (view) {
    case "day": {
      const from = startOfDay(date);
      return { from, to: addDays(from, 1) };
    }
    case "week": {
      const from = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
      return { from, to: addWeeks(from, 1) };
    }
    case "month": {
      const from = getMonthGridStart(date);
      return { from, to: addDays(from, 42) };
    }
  }
}

function getMonthGridStart(date: Date): Date {
  return startOfWeek(startOfMonth(date), { weekStartsOn: WEEK_STARTS_ON });
}

/** The 42 (6 x 7) days shown in month view, Monday-start, possibly spilling into adjacent months. */
export function getMonthGridDays(date: Date): Date[] {
  const gridStart = getMonthGridStart(date);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** The 7 days shown in week view, Monday-start. */
export function getWeekDays(date: Date): Date[] {
  const weekStart = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Moves `date` to the previous/next period for `view`, for prev/next navigation. */
export function shiftDate(
  view: CalendarView,
  date: Date,
  direction: -1 | 1
): Date {
  switch (view) {
    case "day":
      return addDays(date, direction);
    case "week":
      return addWeeks(date, direction);
    case "month":
      // Normalize to the 1st so repeated shifts don't drift across
      // months of different lengths (e.g. Jan 31 -> Feb 28 -> Mar 28).
      return addMonths(startOfMonth(date), direction);
  }
}

/** Human-readable label for the calendar header. */
export function formatRangeLabel(view: CalendarView, date: Date): string {
  switch (view) {
    case "day":
      return format(date, "EEEE, MMMM d, yyyy");
    case "week": {
      const [start, end] = [getWeekDays(date)[0], getWeekDays(date)[6]];
      if (!isSameYear(start, end)) {
        return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
      }
      if (!isSameMonth(start, end)) {
        return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
      }
      return `${format(start, "MMM d")}–${format(end, "d, yyyy")}`;
    }
    case "month":
      return format(startOfMonth(date), "MMMM yyyy");
  }
}

/** Formats a Date as the `YYYY-MM-DD` value used in the `?date=` URL param. */
export function formatDateParam(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Parses a `?date=` URL param, falling back to today for missing/invalid values. */
export function parseDateParam(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return startOfDay(parsed);
  }
  return startOfDay(new Date());
}

/** Parses a `?view=` URL param, falling back to `week` for missing/invalid values. */
export function parseViewParam(value: string | undefined): CalendarView {
  if (value === "day" || value === "week" || value === "month") return value;
  return "week";
}
