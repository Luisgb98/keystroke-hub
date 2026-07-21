import { describe, expect, it } from "vitest";

import {
  DRAG_SNAP_MINUTES,
  MIN_EVENT_DURATION_MINUTES,
  isNoopShift,
  moveEvent,
  moveEventByDays,
  pxToMinutes,
  resizeEvent,
  snapMinutes,
} from "./drag";
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
    linkedIdeas: [],
    ...overrides,
  };
}

describe("snapMinutes", () => {
  it("rounds to the nearest 15-minute step by default", () => {
    expect(snapMinutes(7)).toBe(0);
    expect(snapMinutes(8)).toBe(15);
    expect(snapMinutes(22)).toBe(15);
    expect(snapMinutes(23)).toBe(30);
  });

  it("handles negative deltas symmetrically", () => {
    expect(snapMinutes(-8)).toBe(-15);
    expect(snapMinutes(-7)).toBe(0);
  });

  it("respects a custom step", () => {
    expect(snapMinutes(20, 30)).toBe(30);
  });
});

describe("pxToMinutes", () => {
  it("converts pixels to minutes given px-per-hour", () => {
    expect(pxToMinutes(32, 64)).toBe(30);
    expect(pxToMinutes(64, 64)).toBe(60);
    expect(pxToMinutes(0, 64)).toBe(0);
  });
});

describe("moveEvent", () => {
  it("shifts start/end by whole days and snapped minutes, preserving duration", () => {
    const event = makeEvent();
    const shift = moveEvent(event, 1, 37);
    expect(shift.startsAt).toEqual(new Date("2026-07-09T10:30:00"));
    expect(shift.endsAt).toEqual(new Date("2026-07-09T11:30:00"));
  });

  it("supports negative day and minute offsets", () => {
    const event = makeEvent();
    const shift = moveEvent(event, -2, -20);
    expect(shift.startsAt).toEqual(new Date("2026-07-06T09:45:00"));
    expect(shift.endsAt).toEqual(new Date("2026-07-06T10:45:00"));
  });

  it("is a no-op at zero offset", () => {
    const event = makeEvent();
    const shift = moveEvent(event, 0, 0);
    expect(shift.startsAt).toEqual(event.startsAt);
    expect(shift.endsAt).toEqual(event.endsAt);
  });
});

describe("moveEventByDays", () => {
  it("shifts both boundaries by whole days, time-of-day untouched", () => {
    const event = makeEvent({
      startsAt: new Date("2026-07-08T00:00:00"),
      endsAt: new Date("2026-07-08T00:00:00"),
    });
    const shift = moveEventByDays(event, 3);
    expect(shift.startsAt).toEqual(new Date("2026-07-11T00:00:00"));
    expect(shift.endsAt).toEqual(new Date("2026-07-11T00:00:00"));
  });
});

describe("resizeEvent", () => {
  it("moves the start edge and snaps the delta", () => {
    const event = makeEvent();
    const shift = resizeEvent(event, "start", -37);
    expect(shift.startsAt).toEqual(new Date("2026-07-08T09:30:00"));
    expect(shift.endsAt).toEqual(event.endsAt);
  });

  it("moves the end edge and snaps the delta", () => {
    const event = makeEvent();
    const shift = resizeEvent(event, "end", 37);
    expect(shift.startsAt).toEqual(event.startsAt);
    expect(shift.endsAt).toEqual(new Date("2026-07-08T11:30:00"));
  });

  it("floors the start edge at the minimum duration before the end", () => {
    const event = makeEvent();
    const shift = resizeEvent(event, "start", 1000);
    const durationMinutes =
      (shift.endsAt.getTime() - shift.startsAt.getTime()) / 60_000;
    expect(durationMinutes).toBe(MIN_EVENT_DURATION_MINUTES);
    expect(shift.startsAt.getTime()).toBeLessThan(shift.endsAt.getTime());
  });

  it("floors the end edge at the minimum duration after the start", () => {
    const event = makeEvent();
    const shift = resizeEvent(event, "end", -1000);
    const durationMinutes =
      (shift.endsAt.getTime() - shift.startsAt.getTime()) / 60_000;
    expect(durationMinutes).toBe(MIN_EVENT_DURATION_MINUTES);
  });

  it("never lets an edge cross the opposite edge", () => {
    const event = makeEvent();
    const shift = resizeEvent(event, "start", DRAG_SNAP_MINUTES * 3);
    expect(shift.startsAt.getTime()).toBeLessThan(shift.endsAt.getTime());
  });
});

describe("isNoopShift", () => {
  it("is true when the shift matches the event's current bounds", () => {
    const event = makeEvent();
    expect(
      isNoopShift(event, { startsAt: event.startsAt, endsAt: event.endsAt })
    ).toBe(true);
  });

  it("is false when either boundary differs", () => {
    const event = makeEvent();
    expect(
      isNoopShift(event, {
        startsAt: new Date(event.startsAt.getTime() + 60_000),
        endsAt: event.endsAt,
      })
    ).toBe(false);
  });
});
