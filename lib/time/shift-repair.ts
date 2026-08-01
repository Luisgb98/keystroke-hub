import { TZDate } from "@date-fns/tz";

import { APP_TIMEZONE } from "./app-timezone";

/**
 * One-off repair for rows written before issue #95 was fixed.
 *
 * The bug: `new Date("2026-08-01T19:00:00")` parses the wall clock in the
 * *process* zone. On Vercel (UTC) that stored 19:00Z for a 19:00 Madrid
 * event, so every affected row is offset by the app zone's UTC offset at that
 * moment — +2h under CEST, +1h under CET.
 *
 * The repair is therefore not "subtract two hours": it's "re-read the stored
 * instant's UTC wall clock as an app-zone wall clock". Deriving it from the
 * components rather than from an offset subtraction is what makes it exact
 * across DST — the offset that applied at save time is rediscovered by
 * construction instead of being guessed from the (already wrong) instant.
 *
 * Rows written in local dev, by drag/reschedule, or pulled from Google were
 * never mis-parsed and must NOT be passed through this — see
 * scripts/fix-shifted-times.mts for how the affected set is scoped.
 */
export function repairShiftedInstant(stored: Date): Date {
  const repaired = new TZDate(
    stored.getUTCFullYear(),
    stored.getUTCMonth(),
    stored.getUTCDate(),
    stored.getUTCHours(),
    stored.getUTCMinutes(),
    stored.getUTCSeconds(),
    stored.getUTCMilliseconds(),
    APP_TIMEZONE
  );
  return new Date(repaired.getTime());
}

/** Whether the repair would actually move this instant (false in a UTC-offset zone). */
export function needsShiftRepair(stored: Date): boolean {
  return repairShiftedInstant(stored).getTime() !== stored.getTime();
}
