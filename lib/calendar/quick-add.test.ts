import { describe, expect, it } from "vitest";

import { parseAppDate, parseAppDateTime } from "@/lib/time";

import {
  quickAddFromDayCell,
  quickAddFromNow,
  quickAddFromSlot,
} from "./quick-add";

/**
 * Runs under `TZ=UTC` (vitest.config.ts) while the app zone is Europe/Madrid.
 * Inputs are built with the app-zone parsers rather than
 * `new Date("2026-07-08T00:00:00")`, which under UTC is 02:00 in Madrid — the
 * defaults would then be derived from the wrong day boundary (issue #95).
 */

/** App-zone midnight for a `yyyy-MM-dd` day. */
function day(value: string): Date {
  const parsed = parseAppDate(value);
  if (!parsed) throw new Error(`bad test fixture: ${value}`);
  return parsed;
}

/** The instant of a wall-clock time in the app zone. */
function at(date: string, time: string): Date {
  const parsed = parseAppDateTime(date, time);
  if (!parsed) throw new Error(`bad test fixture: ${date} ${time}`);
  return parsed;
}

describe("quickAddFromSlot", () => {
  it("defaults to a 1h timed event starting on the tapped hour", () => {
    expect(quickAddFromSlot(day("2026-07-08"), 9)).toEqual({
      allDay: false,
      startDate: "2026-07-08",
      startTime: "09:00",
      endDate: "2026-07-08",
      endTime: "10:00",
    });
  });

  it("rolls the end date into the next day when the slot is the last hour", () => {
    expect(quickAddFromSlot(day("2026-07-08"), 23)).toEqual({
      allDay: false,
      startDate: "2026-07-08",
      startTime: "23:00",
      endDate: "2026-07-09",
      endTime: "00:00",
    });
  });

  it("prefills the tapped hour in the app zone, not the server's", () => {
    // Under TZ=UTC the old implementation read `setHours(14)` off a UTC date
    // and prefilled 14:00 UTC, which the calendar then rendered as 16:00.
    const defaults = quickAddFromSlot(day("2026-07-08"), 14);
    expect(defaults.startTime).toBe("14:00");
    expect(at(defaults.startDate, defaults.startTime!).toISOString()).toBe(
      "2026-07-08T12:00:00.000Z"
    );
  });
});

describe("quickAddFromDayCell", () => {
  it("defaults to an all-day event on the given date", () => {
    expect(quickAddFromDayCell(day("2026-07-08"))).toEqual({
      allDay: true,
      startDate: "2026-07-08",
      endDate: "2026-07-08",
    });
  });
});

describe("quickAddFromNow", () => {
  it("rounds up to the next 30-minute mark and defaults a 1h duration", () => {
    expect(quickAddFromNow(at("2026-07-08", "09:10"))).toEqual({
      allDay: false,
      startDate: "2026-07-08",
      startTime: "09:30",
      endDate: "2026-07-08",
      endTime: "10:30",
    });
  });

  it("stays put when already on a 30-minute mark", () => {
    expect(quickAddFromNow(at("2026-07-08", "09:30"))).toEqual({
      allDay: false,
      startDate: "2026-07-08",
      startTime: "09:30",
      endDate: "2026-07-08",
      endTime: "10:30",
    });
  });

  it("rolls over midnight when rounding up near end of day", () => {
    expect(quickAddFromNow(at("2026-07-08", "23:45"))).toEqual({
      allDay: false,
      startDate: "2026-07-09",
      startTime: "00:00",
      endDate: "2026-07-09",
      endTime: "01:00",
    });
  });

  it("reads the wall clock in the app zone in winter too", () => {
    // Madrid is CET (+1) in January: 09:10 local is 08:10Z.
    const now = at("2026-01-15", "09:10");
    expect(now.toISOString()).toBe("2026-01-15T08:10:00.000Z");
    expect(quickAddFromNow(now)).toEqual({
      allDay: false,
      startDate: "2026-01-15",
      startTime: "09:30",
      endDate: "2026-01-15",
      endTime: "10:30",
    });
  });
});

/**
 * Pinned for #115. Quick-add is deliberately **track-agnostic** — the track is
 * chosen afterwards, in the editor — so these defaults still describe a span a
 * work event may legitimately hold. What matters is that only the very last
 * slot of the day can cross midnight, and that `EventEditor` repairs exactly
 * that case when a single-day track is picked (see its own suite).
 */
describe("quick-add defaults and the single-day rule", () => {
  it("keeps every slot but the last one inside its own day", () => {
    const day = new Date("2026-07-08T12:00:00Z");
    for (const hour of [0, 9, 22]) {
      const defaults = quickAddFromSlot(day, hour);
      expect(defaults.endDate, `hour ${hour}`).toBe(defaults.startDate);
    }
  });

  it("documents the one slot that does — 23:00, ending at the next day's 00:00", () => {
    // A real work meeting, and an impossible stream. `EventEditor` moves the
    // end to 23:59 the moment Content or Stream is chosen, so the dialog never
    // opens on a form that is already invalid.
    const defaults = quickAddFromSlot(new Date("2026-07-08T12:00:00Z"), 23);
    expect(defaults.startTime).toBe("23:00");
    expect(defaults.endTime).toBe("00:00");
    expect(defaults.endDate).not.toBe(defaults.startDate);
  });

  it("keeps a day-cell tap on exactly one day", () => {
    const defaults = quickAddFromDayCell(new Date("2026-07-08T12:00:00Z"));
    expect(defaults.endDate).toBe(defaults.startDate);
    expect(defaults.allDay).toBe(true);
  });

  it("keeps the header button inside the current day, even late at night", () => {
    // 22:40 UTC is 00:40 Madrid the next day, and +1h stays on it.
    const defaults = quickAddFromNow(new Date("2026-07-08T22:40:00Z"));
    expect(defaults.endDate).toBe(defaults.startDate);
  });
});
