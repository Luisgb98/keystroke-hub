import {
  appAddDays,
  appIsSameMonth,
  appIsSameYear,
  appStartOfWeek,
  formatAppDateParam,
  formatInAppZone,
  parseAppDate,
} from "@/lib/time";

import { formatDateParam, isValidDateParam, todayParam } from "./dates";

/**
 * Weeks start on Monday throughout the app and every boundary is computed in
 * the app timezone (see lib/time) — mirrors lib/calendar/range.ts.
 */

/** Any `yyyy-MM-dd` value that reaches here has already passed `isValidDateParam`. */
function requireAppDate(value: string): Date {
  const parsed = parseAppDate(value);
  if (!parsed) throw new Error(`Not a valid yyyy-MM-dd value: ${value}`);
  return parsed;
}

/** Normalizes any `yyyy-MM-dd` value to the Monday that starts its week. */
export function weekStartParam(value: string): string {
  return formatAppDateParam(appStartOfWeek(requireAppDate(value)));
}

/** The Monday of "this week", in the app timezone — same resolution as `todayParam`. */
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
  return formatDateParam(appAddDays(requireAppDate(value), direction * 7));
}

export function isCurrentWeekParam(value: string): boolean {
  return value === currentWeekParam();
}

/** The 7 `yyyy-MM-dd` values (Mon–Sun) for the week starting at `weekStart`. */
export function weekDayParams(weekStart: string): string[] {
  const start = requireAppDate(weekStart);
  return Array.from({ length: 7 }, (_, i) =>
    formatDateParam(appAddDays(start, i))
  );
}

/** Human-readable week label, e.g. "Jul 6–12, 2026" (mirrors `formatRangeLabel`'s week case in lib/calendar/range.ts). */
export function formatWeekLabel(weekStart: string): string {
  const start = requireAppDate(weekStart);
  const end = appAddDays(start, 6);
  if (!appIsSameYear(start, end)) {
    return `${formatInAppZone(start, "MMM d, yyyy")} – ${formatInAppZone(end, "MMM d, yyyy")}`;
  }
  if (!appIsSameMonth(start, end)) {
    return `${formatInAppZone(start, "MMM d")} – ${formatInAppZone(end, "MMM d, yyyy")}`;
  }
  return `${formatInAppZone(start, "MMM d")}–${formatInAppZone(end, "d, yyyy")}`;
}
