import { addHours } from "date-fns";

import { formatDateParam } from "./range";

/** Form-default values for the create dialog — string-shaped to match native date/time inputs. */
export interface QuickAddDefaults {
  allDay: boolean;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
}

function formatTimeParam(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Tapping an empty hour slot in the day/week time grid: 1h duration starting on the hour. */
export function quickAddFromSlot(day: Date, hour: number): QuickAddDefaults {
  const start = new Date(day);
  start.setHours(hour, 0, 0, 0);
  const end = addHours(start, 1);

  return {
    allDay: false,
    startDate: formatDateParam(start),
    startTime: formatTimeParam(start.getHours(), start.getMinutes()),
    endDate: formatDateParam(end),
    endTime: formatTimeParam(end.getHours(), end.getMinutes()),
  };
}

/** Tapping a month-view cell's "+" affordance: all-day default for that date. */
export function quickAddFromDayCell(day: Date): QuickAddDefaults {
  const dateParam = formatDateParam(day);
  return {
    allDay: true,
    startDate: dateParam,
    endDate: dateParam,
  };
}

/** The header "+ New event" fallback: starts at the next 30-minute mark, 1h duration. */
export function quickAddFromNow(now: Date): QuickAddDefaults {
  const start = new Date(now);
  start.setSeconds(0, 0);
  const remainder = start.getMinutes() % 30;
  if (remainder !== 0) {
    start.setMinutes(start.getMinutes() + (30 - remainder));
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  return {
    allDay: false,
    startDate: formatDateParam(start),
    startTime: formatTimeParam(start.getHours(), start.getMinutes()),
    endDate: formatDateParam(end),
    endTime: formatTimeParam(end.getHours(), end.getMinutes()),
  };
}
