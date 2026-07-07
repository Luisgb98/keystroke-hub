import { describe, expect, it } from "vitest";

import {
  clampEventToDay,
  eventOverlapsDay,
  minutesSinceMidnight,
} from "./segments";
import type { CalendarEvent } from "./types";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "1",
    track: "work",
    title: "Test event",
    description: null,
    startsAt: new Date("2026-07-08T10:00:00"),
    endsAt: new Date("2026-07-08T11:00:00"),
    allDay: false,
    conflictNote: null,
    ...overrides,
  };
}

describe("eventOverlapsDay", () => {
  it("is true for an event fully within the day", () => {
    expect(eventOverlapsDay(makeEvent(), new Date("2026-07-08"))).toBe(true);
  });

  it("is false for an event on a different day", () => {
    expect(eventOverlapsDay(makeEvent(), new Date("2026-07-09"))).toBe(false);
  });

  it("is true for a multi-day event on each spanned day", () => {
    const event = makeEvent({
      startsAt: new Date("2026-07-08T22:00:00"),
      endsAt: new Date("2026-07-10T02:00:00"),
    });
    expect(eventOverlapsDay(event, new Date("2026-07-08"))).toBe(true);
    expect(eventOverlapsDay(event, new Date("2026-07-09"))).toBe(true);
    expect(eventOverlapsDay(event, new Date("2026-07-10"))).toBe(true);
    expect(eventOverlapsDay(event, new Date("2026-07-11"))).toBe(false);
  });
});

describe("clampEventToDay", () => {
  it("leaves a single-day event untouched", () => {
    const event = makeEvent();
    const segment = clampEventToDay(event, new Date("2026-07-08"));
    expect(segment.start).toEqual(event.startsAt);
    expect(segment.end).toEqual(event.endsAt);
  });

  it("clamps an event crossing midnight to the requested day's boundaries", () => {
    const event = makeEvent({
      startsAt: new Date("2026-07-08T22:00:00"),
      endsAt: new Date("2026-07-09T02:00:00"),
    });

    const day1 = clampEventToDay(event, new Date("2026-07-08"));
    expect(day1.start).toEqual(event.startsAt);
    expect(day1.end.toDateString()).toBe(new Date("2026-07-08").toDateString());
    expect(day1.end.getHours()).toBe(23);

    const day2 = clampEventToDay(event, new Date("2026-07-09"));
    expect(day2.start.toDateString()).toBe(
      new Date("2026-07-09").toDateString()
    );
    expect(day2.start.getHours()).toBe(0);
    expect(day2.end).toEqual(event.endsAt);
  });
});

describe("minutesSinceMidnight", () => {
  it("computes minutes for a plain time", () => {
    expect(minutesSinceMidnight(new Date("2026-07-08T01:30:00"))).toBe(90);
  });

  it("is 0 at midnight", () => {
    expect(minutesSinceMidnight(new Date("2026-07-08T00:00:00"))).toBe(0);
  });
});
