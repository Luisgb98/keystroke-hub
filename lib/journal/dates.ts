import {
  appAddDays,
  appTodayParam,
  formatAppDateParam,
  formatAppDateString,
  parseAppDate,
} from "@/lib/time";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Formats a Date as the `yyyy-MM-dd` value stored in `daily_logs.log_date` and used in the `?date=` URL param. */
export function formatDateParam(date: Date): string {
  return formatAppDateParam(date);
}

/**
 * "Today", in the app timezone (see lib/time) — the same resolution the
 * calendar uses, so the two tracks always agree on which day it is.
 *
 * This used to be server-local, which on Vercel (UTC) meant the journal
 * rolled over to the next day at 22:00/23:00 Madrid time, and disagreed with
 * `DayHeader`'s browser-side "today" during the same window (issue #95).
 * Resolving both sides in one fixed zone removes the divergence and keeps the
 * server and browser render passes identical.
 */
export function todayParam(): string {
  return appTodayParam();
}

export function isValidDateParam(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  return parseAppDate(value) !== null;
}

/** Parses a `?date=` URL param, falling back to today for missing/invalid values. */
export function parseDateParam(value: string | undefined): string {
  if (value && isValidDateParam(value)) return value;
  return todayParam();
}

/** Moves a `yyyy-MM-dd` value by one calendar day, for prev/next day navigation and rollover targets. */
export function shiftDateParam(value: string, direction: -1 | 1): string {
  const parsed = parseAppDate(value);
  if (!parsed) return value;
  return formatAppDateParam(appAddDays(parsed, direction));
}

export function isTodayParam(value: string): boolean {
  return value === todayParam();
}

/** Human-readable day header label, e.g. "Wednesday, July 8, 2026". */
export function formatDayLabel(value: string): string {
  return formatAppDateString(value, "EEEE, MMMM d, yyyy");
}

/** Short label for compact contexts (standup cards), e.g. "Jul 8". */
export function formatShortDayLabel(value: string): string {
  return formatAppDateString(value, "MMM d");
}
