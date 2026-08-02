import { describe, expect, it } from "vitest";

import { formatInAppZone, parseAppDate, parseAppDateTime } from "@/lib/time";

import {
  clampEventToDay,
  eventOverlapsDay,
  minutesSinceMidnight,
} from "./segments";
import type { CalendarEvent } from "./types";

/**
 * Runs under `TZ=UTC` (vitest.config.ts) while the app zone is Europe/Madrid,
 * so fixtures are built with the app-zone parsers: `new Date("2026-07-08T00:00:00")`
 * is 02:00 in Madrid under UTC and would put every boundary on the wrong side
 * of midnight (issue #95).
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

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "1",
    track: "work",
    title: "Test event",
    description: null,
    startsAt: at("2026-07-08", "10:00"),
    endsAt: at("2026-07-08", "11:00"),
    allDay: false,
    conflictNote: null,
    linkedIdeas: [],
    streamId: null,
    ...overrides,
  };
}

describe("eventOverlapsDay", () => {
  it("is true for an event fully within the day", () => {
    expect(eventOverlapsDay(makeEvent(), day("2026-07-08"))).toBe(true);
  });

  it("is false for an event on a different day", () => {
    expect(eventOverlapsDay(makeEvent(), day("2026-07-09"))).toBe(false);
  });

  it("is true for a multi-day event on each spanned day", () => {
    const event = makeEvent({
      startsAt: at("2026-07-08", "22:00"),
      endsAt: at("2026-07-10", "02:00"),
    });
    expect(eventOverlapsDay(event, day("2026-07-08"))).toBe(true);
    expect(eventOverlapsDay(event, day("2026-07-09"))).toBe(true);
    expect(eventOverlapsDay(event, day("2026-07-10"))).toBe(true);
    expect(eventOverlapsDay(event, day("2026-07-11"))).toBe(false);
  });
});

describe("clampEventToDay", () => {
  it("leaves a single-day event untouched", () => {
    const event = makeEvent();
    const segment = clampEventToDay(event, day("2026-07-08"));
    expect(segment.start).toEqual(event.startsAt);
    expect(segment.end).toEqual(event.endsAt);
  });

  it("clamps an event crossing midnight to the requested day's boundaries", () => {
    const event = makeEvent({
      startsAt: at("2026-07-08", "22:00"),
      endsAt: at("2026-07-09", "02:00"),
    });

    const day1 = clampEventToDay(event, day("2026-07-08"));
    expect(day1.start).toEqual(event.startsAt);
    expect(formatInAppZone(day1.end, "yyyy-MM-dd HH:mm")).toBe(
      "2026-07-08 23:59"
    );

    const day2 = clampEventToDay(event, day("2026-07-09"));
    expect(formatInAppZone(day2.start, "yyyy-MM-dd HH:mm")).toBe(
      "2026-07-09 00:00"
    );
    expect(day2.end).toEqual(event.endsAt);
  });
});

describe("minutesSinceMidnight", () => {
  it("computes minutes for a plain time", () => {
    expect(minutesSinceMidnight(at("2026-07-08", "01:30"))).toBe(90);
  });

  it("is 0 at midnight", () => {
    expect(minutesSinceMidnight(day("2026-07-08"))).toBe(0);
  });
});
