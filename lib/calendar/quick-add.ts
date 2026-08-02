import {
  appWallClock,
  formatAppDateParam,
  formatAppTimeParam,
  parseAppDateTime,
} from "@/lib/time";

/** Form-default values for the create dialog — string-shaped to match the date/time pickers. */
export interface QuickAddDefaults {
  allDay: boolean;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
}

/**
 * Every default here is derived in the app timezone (see lib/time): tapping
 * the 14:00 slot must prefill "14:00" whether the dialog is opened from a
 * server render on Vercel or from the browser (issue #95).
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** Tapping an empty hour slot in the day/week time grid: 1h duration starting on the hour. */
export function quickAddFromSlot(day: Date, hour: number): QuickAddDefaults {
  // A grid row *is* a wall-clock hour — `DayColumn` positions blocks by
  // `appMinutesSinceMidnight`, which reads the wall clock too. Resolving the
  // row through the same wall clock keeps the two in step; adding elapsed
  // hours to midnight would drift by one on a DST changeover day.
  const dayParam = formatAppDateParam(day);
  const start = parseAppDateTime(
    dayParam,
    `${String(hour).padStart(2, "0")}:00`
  );
  if (!start) throw new Error(`unreachable slot: ${dayParam} hour ${hour}`);
  const end = new Date(start.getTime() + HOUR_MS);

  return {
    allDay: false,
    startDate: formatAppDateParam(start),
    startTime: formatAppTimeParam(start),
    endDate: formatAppDateParam(end),
    endTime: formatAppTimeParam(end),
  };
}

/** Tapping a month-view cell's "+" affordance: all-day default for that date. */
export function quickAddFromDayCell(day: Date): QuickAddDefaults {
  const dateParam = formatAppDateParam(day);
  return {
    allDay: true,
    startDate: dateParam,
    endDate: dateParam,
  };
}

/** The header "+ New event" fallback: starts at the next 30-minute mark, 1h duration. */
export function quickAddFromNow(now: Date): QuickAddDefaults {
  const wall = appWallClock(now);
  const remainder = wall.getMinutes() % 30;
  const toNextMark = remainder === 0 ? 0 : 30 - remainder;
  // Snapped in absolute time: a minute is the same length in every zone, and
  // the app zone's minute-of-hour always matches UTC's, so this needs no
  // wall-clock arithmetic to survive a DST changeover.
  const start = new Date(
    now.getTime() -
      (wall.getSeconds() * 1000 + wall.getMilliseconds()) +
      toNextMark * MINUTE_MS
  );
  const end = new Date(start.getTime() + HOUR_MS);

  return {
    allDay: false,
    startDate: formatAppDateParam(start),
    startTime: formatAppTimeParam(start),
    endDate: formatAppDateParam(end),
    endTime: formatAppTimeParam(end),
  };
}
