import { describe, expect, it } from "vitest";

import { buildAgenda } from "./agenda";
import type { CalendarEvent } from "./types";

const NOW = new Date("2026-07-08T12:00:00");

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "1",
    track: "work",
    title: "Test event",
    description: null,
    startsAt: new Date("2026-07-08T14:00:00"),
    endsAt: new Date("2026-07-08T15:00:00"),
    allDay: false,
    conflictNote: null,
    linkedIdeas: [],
    ...overrides,
  };
}

describe("buildAgenda", () => {
  it("returns no groups for empty input", () => {
    expect(buildAgenda([], NOW)).toEqual([]);
  });

  it("buckets events into Today and Tomorrow", () => {
    const today = makeEvent({
      id: "today",
      startsAt: new Date("2026-07-08T14:00:00"),
      endsAt: new Date("2026-07-08T15:00:00"),
    });
    const tomorrow = makeEvent({
      id: "tomorrow",
      startsAt: new Date("2026-07-09T09:00:00"),
      endsAt: new Date("2026-07-09T10:00:00"),
    });

    const groups = buildAgenda([today, tomorrow], NOW);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Today");
    expect(groups[0].items.map((i) => i.event.id)).toEqual(["today"]);
    expect(groups[1].label).toBe("Tomorrow");
    expect(groups[1].items.map((i) => i.event.id)).toEqual(["tomorrow"]);
  });

  it("excludes events entirely outside the today+tomorrow horizon", () => {
    const dayAfterTomorrow = makeEvent({
      startsAt: new Date("2026-07-10T09:00:00"),
      endsAt: new Date("2026-07-10T10:00:00"),
    });

    expect(buildAgenda([dayAfterTomorrow], NOW)).toEqual([]);
  });

  it("pins all-day events before timed events within the same day", () => {
    const timed = makeEvent({
      id: "timed",
      startsAt: new Date("2026-07-08T13:00:00"),
      endsAt: new Date("2026-07-08T13:30:00"),
    });
    const allDay = makeEvent({
      id: "all-day",
      startsAt: new Date("2026-07-08T00:00:00"),
      endsAt: new Date("2026-07-08T00:00:00"),
      allDay: true,
    });

    const groups = buildAgenda([timed, allDay], NOW);

    expect(groups[0].items.map((i) => i.event.id)).toEqual([
      "all-day",
      "timed",
    ]);
    expect(groups[0].items[0].timeLabel).toBe("All day");
  });

  it("labels an in-progress event 'Now' and marks inProgress", () => {
    const inProgress = makeEvent({
      startsAt: new Date("2026-07-08T11:00:00"),
      endsAt: new Date("2026-07-08T13:00:00"),
    });

    const groups = buildAgenda([inProgress], NOW);

    expect(groups[0].items[0].timeLabel).toBe("Now");
    expect(groups[0].items[0].inProgress).toBe(true);
  });

  it("formats a future timed event's start as HH:mm and marks it not in progress", () => {
    const groups = buildAgenda([makeEvent()], NOW);

    expect(groups[0].items[0].timeLabel).toBe("14:00");
    expect(groups[0].items[0].inProgress).toBe(false);
  });

  it("excludes a timed event that has already ended", () => {
    const ended = makeEvent({
      startsAt: new Date("2026-07-08T09:00:00"),
      endsAt: new Date("2026-07-08T10:00:00"),
    });

    expect(buildAgenda([ended], NOW)).toEqual([]);
  });

  it("excludes a timed event ending exactly at now", () => {
    const endsNow = makeEvent({
      startsAt: new Date("2026-07-08T11:00:00"),
      endsAt: NOW,
    });

    expect(buildAgenda([endsNow], NOW)).toEqual([]);
  });

  it("keeps today's all-day event visible even after its literal endsAt midnight has passed", () => {
    const allDayToday = makeEvent({
      startsAt: new Date("2026-07-08T00:00:00"),
      endsAt: new Date("2026-07-08T00:00:00"),
      allDay: true,
    });

    const groups = buildAgenda([allDayToday], NOW);

    expect(groups[0].items).toHaveLength(1);
  });

  it("excludes an all-day event from a previous day", () => {
    const allDayYesterday = makeEvent({
      startsAt: new Date("2026-07-07T00:00:00"),
      endsAt: new Date("2026-07-07T00:00:00"),
      allDay: true,
    });

    expect(buildAgenda([allDayYesterday], NOW)).toEqual([]);
  });

  it("shows a multi-day all-day event once per day bucket it covers", () => {
    const spanning = makeEvent({
      id: "spanning",
      startsAt: new Date("2026-07-08T00:00:00"),
      endsAt: new Date("2026-07-09T00:00:00"),
      allDay: true,
    });

    const groups = buildAgenda([spanning], NOW);

    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((i) => i.event.id)).toEqual(["spanning"]);
    expect(groups[1].items.map((i) => i.event.id)).toEqual(["spanning"]);
  });

  it("caps the total number of rows across the whole agenda", () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent({
        id: `today-${i}`,
        startsAt: new Date(
          `2026-07-08T${String(13 + i).padStart(2, "0")}:00:00`
        ),
        endsAt: new Date(`2026-07-08T${String(13 + i).padStart(2, "0")}:30:00`),
      })
    );
    const tomorrowEvents = Array.from({ length: 5 }, (_, i) =>
      makeEvent({
        id: `tomorrow-${i}`,
        startsAt: new Date(
          `2026-07-09T${String(9 + i).padStart(2, "0")}:00:00`
        ),
        endsAt: new Date(`2026-07-09T${String(9 + i).padStart(2, "0")}:30:00`),
      })
    );

    const groups = buildAgenda([...events, ...tomorrowEvents], NOW, 3);
    const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

    expect(totalItems).toBe(3);
  });

  it("drops an empty day bucket entirely rather than rendering a headerless gap", () => {
    const tomorrowOnly = makeEvent({
      startsAt: new Date("2026-07-09T09:00:00"),
      endsAt: new Date("2026-07-09T10:00:00"),
    });

    const groups = buildAgenda([tomorrowOnly], NOW);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Tomorrow");
  });
});
