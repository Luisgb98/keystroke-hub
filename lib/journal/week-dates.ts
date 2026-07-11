import {
  addDays,
  format,
  isSameMonth,
  isSameYear,
  startOfWeek,
} from "date-fns";

import { formatDateParam, isValidDateParam, todayParam } from "./dates";

/** Weeks start on Monday throughout the app — mirrors lib/calendar/range.ts. */
const WEEK_STARTS_ON = 1;

function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

/** Normalizes any `yyyy-MM-dd` value to the Monday that starts its week. */
export function weekStartParam(value: string): string {
  return formatDateParam(
    startOfWeek(parseLocalDate(value), { weekStartsOn: WEEK_STARTS_ON })
  );
}

/** The Monday of "this week", server-local — same resolution as `todayParam`. */
export function currentWeekParam(): string {
  return weekStartParam(todayParam());
}

/** Parses a `?week=` URL param, normalizing to its Monday; falls back to the current week for missing/invalid values. */
export function parseWeekParam(value: string | undefined): string {
  if (value && isValidDateParam(value)) return weekStartParam(value);
  return currentWeekParam();
}

/** Moves a week-start value by whole weeks, for prev/next week navigation. */
export function shiftWeekParam(value: string, direction: -1 | 1): string {
  return formatDateParam(addDays(parseLocalDate(value), direction * 7));
}

export function isCurrentWeekParam(value: string): boolean {
  return value === currentWeekParam();
}

/** The 7 `yyyy-MM-dd` values (Mon–Sun) for the week starting at `weekStart`. */
export function weekDayParams(weekStart: string): string[] {
  const start = parseLocalDate(weekStart);
  return Array.from({ length: 7 }, (_, i) =>
    formatDateParam(addDays(start, i))
  );
}

/** Human-readable week label, e.g. "Jul 6–12, 2026" (mirrors `formatRangeLabel`'s week case in lib/calendar/range.ts). */
export function formatWeekLabel(weekStart: string): string {
  const start = parseLocalDate(weekStart);
  const end = addDays(start, 6);
  if (!isSameYear(start, end)) {
    return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
  }
  if (!isSameMonth(start, end)) {
    return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  }
  return `${format(start, "MMM d")}–${format(end, "d, yyyy")}`;
}
