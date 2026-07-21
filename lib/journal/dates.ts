import { addDays, format } from "date-fns";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Local midnight for a `yyyy-MM-dd` string — matches `lib/calendar/event-schema.ts`'s convention. */
function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

/** Formats a Date as the `yyyy-MM-dd` value stored in `daily_logs.log_date` and used in the `?date=` URL param. */
export function formatDateParam(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * "Today", server-local — same resolution as the calendar's `new Date()`
 * (`lib/calendar/range.ts`), which is UTC on Vercel. See docs/journal.md for
 * why this keeps parity rather than trying to be timezone-aware: past days
 * are always editable anyway.
 */
export function todayParam(): string {
  return formatDateParam(new Date());
}

export function isValidDateParam(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  return !Number.isNaN(parseLocalDate(value).getTime());
}

/** Parses a `?date=` URL param, falling back to today for missing/invalid values. */
export function parseDateParam(value: string | undefined): string {
  if (value && isValidDateParam(value)) return value;
  return todayParam();
}

/** Moves a `yyyy-MM-dd` value by one calendar day, for prev/next day navigation and rollover targets. */
export function shiftDateParam(value: string, direction: -1 | 1): string {
  return formatDateParam(addDays(parseLocalDate(value), direction));
}

export function isTodayParam(value: string): boolean {
  return value === todayParam();
}

/** Human-readable day header label, e.g. "Wednesday, July 8, 2026". */
export function formatDayLabel(value: string): string {
  return format(parseLocalDate(value), "EEEE, MMMM d, yyyy");
}

/** Short label for compact contexts (standup cards), e.g. "Jul 8". */
export function formatShortDayLabel(value: string): string {
  return format(parseLocalDate(value), "MMM d");
}
