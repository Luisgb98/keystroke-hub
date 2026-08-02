import { TZDate, tz } from "@date-fns/tz";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  format,
  isSameDay,
  isSameMonth,
  isSameYear,
  isValid,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { APP_TIMEZONE } from "./app-timezone";

export { APP_TIMEZONE, DEFAULT_APP_TIMEZONE } from "./app-timezone";

/**
 * The one timezone convention (issue #95). Two rules, and everything else
 * follows:
 *
 * 1. **Every `Date` in the app is an absolute instant.** Rows in the database,
 *    props crossing the server→client boundary, values handed to date-fns —
 *    all of them. No `Date` anywhere carries a "which zone am I?" flag,
 *    because `TZDate` does not survive React's server→client serialization:
 *    the server pass would render the app zone and the browser pass the
 *    device zone, which is a hydration mismatch instead of a fix.
 * 2. **Wall-clock meaning is applied only here.** Parsing a `yyyy-MM-dd` /
 *    `HH:mm` form value into an instant, formatting an instant for display,
 *    and any day/week/month boundary all go through this module with
 *    `APP_TIMEZONE` pinned explicitly. Because the zone is passed in rather
 *    than read off the process, the result is byte-identical whether the code
 *    runs on Vercel (UTC), in local dev (Europe/Madrid), or in CI.
 *
 * Reaching for bare `new Date("…T…")`, `date.getHours()`, or `format(date, …)`
 * without a zone re-introduces the bug — use the helpers below instead.
 */

/** date-fns `in:` context pinned to the app timezone. Stateless, so one instance is reused. */
const appTz = tz(APP_TIMEZONE);

/** The `{ in }` option every date-fns call in the app passes. */
export const inAppZone = { in: appTz } as const;

/** Calendar weeks start on Monday throughout the app. */
export const WEEK_STARTS_ON = 1;

const DATE_PARAM_FORMAT = "yyyy-MM-dd";
const TIME_PARAM_FORMAT = "HH:mm";

/**
 * Narrows a `TZDate` back to a plain absolute instant.
 *
 * Every public helper here returns one. `TZDate.toISOString()` emits an
 * offset-suffixed string rather than a `Z` one, so letting a `TZDate` reach
 * the database driver or an RSC payload would leak zone-shaped values into
 * places that expect plain instants.
 */
function toInstant(date: Date): Date {
  return new Date(date.getTime());
}

/** Reads an instant's wall-clock parts in the app timezone (`.getHours()`, `.getDate()`, …). */
export function appWallClock(date: Date): TZDate {
  return new TZDate(date, APP_TIMEZONE);
}

/**
 * `yyyy-MM-dd` → the instant of that day's midnight in the app timezone, or
 * `null` when the string isn't a real calendar day.
 *
 * Built from date components (not from a string) because `new TZDate(str, tz)`
 * parses the string against the *process* zone before re-zoning it — exactly
 * the behavior this module exists to avoid. The re-format guard rejects values
 * that are well-shaped but nonexistent, e.g. `2026-02-30`.
 */
export function parseAppDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new TZDate(
    Number(year),
    Number(month) - 1,
    Number(day),
    0,
    0,
    0,
    0,
    APP_TIMEZONE
  );
  if (!isValid(parsed)) return null;
  return format(parsed, DATE_PARAM_FORMAT) === value ? toInstant(parsed) : null;
}

/**
 * `yyyy-MM-dd` + `HH:mm` → the instant that wall-clock time denotes in the app
 * timezone, or `null` when either part isn't real.
 *
 * On the spring-forward DST boundary the requested wall clock may not exist
 * (Madrid has no 02:30 on the changeover day); `TZDate` resolves it forward
 * into the new offset, so the saved instant is the nearest real one rather
 * than a silent failure.
 */
export function parseAppDateTime(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  if (parseAppDate(date) === null) return null;

  const [, year, month, day] = dateMatch;
  const [, hours, minutes] = timeMatch;
  if (Number(hours) > 23 || Number(minutes) > 59) return null;

  const parsed = new TZDate(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    0,
    0,
    APP_TIMEZONE
  );
  return isValid(parsed) ? toInstant(parsed) : null;
}

/** Formats an instant with a date-fns pattern, read in the app timezone. */
export function formatInAppZone(date: Date, pattern: string): string {
  return format(date, pattern, inAppZone);
}

/** Instant → the `yyyy-MM-dd` string used in forms, URL params and `daily_logs.log_date`. */
export function formatAppDateParam(date: Date): string {
  return formatInAppZone(date, DATE_PARAM_FORMAT);
}

/** Instant → the `HH:mm` string used in form time fields. */
export function formatAppTimeParam(date: Date): string {
  return formatInAppZone(date, TIME_PARAM_FORMAT);
}

/**
 * Formats a bare `yyyy-MM-dd` value (a date with no time-of-day, e.g. a
 * journal log date or a meeting note's date) for display. Falls back to the
 * raw string rather than throwing, so one bad row can't blank a page.
 */
export function formatAppDateString(value: string, pattern: string): string {
  const parsed = parseAppDate(value);
  return parsed ? formatInAppZone(parsed, pattern) : value;
}

/** "Today" in the app timezone, as `yyyy-MM-dd`. */
export function appTodayParam(now: Date = new Date()): string {
  return formatAppDateParam(now);
}

/** Midnight of the instant's day, in the app timezone. */
export function appStartOfDay(date: Date): Date {
  return toInstant(startOfDay(date, inAppZone));
}

/** The last millisecond of the instant's day, in the app timezone. */
export function appEndOfDay(date: Date): Date {
  return toInstant(endOfDay(date, inAppZone));
}

/** Midnight of the Monday starting the instant's week, in the app timezone. */
export function appStartOfWeek(date: Date): Date {
  return toInstant(
    startOfWeek(date, { ...inAppZone, weekStartsOn: WEEK_STARTS_ON })
  );
}

/** Midnight of the 1st of the instant's month, in the app timezone. */
export function appStartOfMonth(date: Date): Date {
  return toInstant(startOfMonth(date, inAppZone));
}

/**
 * Adds whole calendar days in the app timezone, so the wall-clock time of day
 * survives a DST changeover (adding 24h of milliseconds would not).
 */
export function appAddDays(date: Date, amount: number): Date {
  return toInstant(addDays(date, amount, inAppZone));
}

/** Adds whole calendar weeks in the app timezone. */
export function appAddWeeks(date: Date, amount: number): Date {
  return toInstant(addWeeks(date, amount, inAppZone));
}

/** Adds whole calendar months in the app timezone. */
export function appAddMonths(date: Date, amount: number): Date {
  return toInstant(addMonths(date, amount, inAppZone));
}

/** Whether two instants fall on the same calendar day in the app timezone. */
export function appIsSameDay(a: Date, b: Date): boolean {
  return isSameDay(a, b, inAppZone);
}

/** Whether two instants fall in the same calendar month in the app timezone. */
export function appIsSameMonth(a: Date, b: Date): boolean {
  return isSameMonth(a, b, inAppZone);
}

/** Whether two instants fall in the same calendar year in the app timezone. */
export function appIsSameYear(a: Date, b: Date): boolean {
  return isSameYear(a, b, inAppZone);
}

/**
 * Renders an hour-of-day number (0–23) as a time-grid gutter label, e.g.
 * `9 a.m.`
 *
 * A grid row is a plain hour index, not an instant, so it's anchored in UTC:
 * building `new Date(2000, 0, 1, hour)` instead would ask the *renderer's*
 * zone for the label, and in a zone whose midnight didn't exist on that date
 * the server and browser passes could disagree — a hydration mismatch, which
 * is the failure mode this module exists to rule out (issue #95).
 */
export function formatHourLabel(hour: number, pattern = "h a"): string {
  return format(new Date(Date.UTC(2000, 0, 1, hour)), pattern, {
    in: tz("UTC"),
  });
}

/**
 * Minutes elapsed since the instant's app-timezone midnight, with fractional
 * minutes for seconds precision — the vertical coordinate of the time grid.
 */
export function appMinutesSinceMidnight(date: Date): number {
  const wall = appWallClock(date);
  return wall.getHours() * 60 + wall.getMinutes() + wall.getSeconds() / 60;
}
