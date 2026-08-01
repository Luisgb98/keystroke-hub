import { describe, expect, it } from "vitest";

import { parseAppDateTime } from "@/lib/time";

import { buildAgenda } from "./agenda";
import type { CalendarEvent } from "./types";

/**
 * Runs under `TZ=UTC` (vitest.config.ts) while the app zone is Europe/Madrid.
 * Fixtures are built in the app zone so "Today"/"Tomorrow" bucketing and the
 * `HH:mm` labels are asserted against the wall clock the owner actually sees,
 * not the server's (issue #95).
 */

/** The instant of a wall-clock time in the app zone. */
function at(date: string, time: string): Date {
  const parsed = parseAppDateTime(date, time);
  if (!parsed) throw new Error(`bad test fixture: ${date} ${time}`);
  return parsed;
}

const NOW = at("2026-07-08", "12:00");

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "1",
    track: "work",
    title: "Test event",
    description: null,
    startsAt: at("2026-07-08", "14:00"),
    endsAt: at("2026-07-08", "15:00"),
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
      startsAt: at("2026-07-08", "14:00"),
      endsAt: at("2026-07-08", "15:00"),
    });
    const tomorrow = makeEvent({
      id: "tomorrow",
      startsAt: at("2026-07-09", "09:00"),
      endsAt: at("2026-07-09", "10:00"),
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
      startsAt: at("2026-07-10", "09:00"),
      endsAt: at("2026-07-10", "10:00"),
    });

    expect(buildAgenda([dayAfterTomorrow], NOW)).toEqual([]);
  });

  it("pins all-day events before timed events within the same day", () => {
    const timed = makeEvent({
      id: "timed",
      startsAt: at("2026-07-08", "13:00"),
      endsAt: at("2026-07-08", "13:30"),
    });
    const allDay = makeEvent({
      id: "all-day",
      startsAt: at("2026-07-08", "00:00"),
      endsAt: at("2026-07-08", "00:00"),
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
      startsAt: at("2026-07-08", "11:00"),
      endsAt: at("2026-07-08", "13:00"),
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
      startsAt: at("2026-07-08", "09:00"),
      endsAt: at("2026-07-08", "10:00"),
    });

    expect(buildAgenda([ended], NOW)).toEqual([]);
  });

  it("excludes a timed event ending exactly at now", () => {
    const endsNow = makeEvent({
      startsAt: at("2026-07-08", "11:00"),
      endsAt: NOW,
    });

    expect(buildAgenda([endsNow], NOW)).toEqual([]);
  });

  it("keeps today's all-day event visible even after its literal endsAt midnight has passed", () => {
    const allDayToday = makeEvent({
      startsAt: at("2026-07-08", "00:00"),
      endsAt: at("2026-07-08", "00:00"),
      allDay: true,
    });

    const groups = buildAgenda([allDayToday], NOW);

    expect(groups[0].items).toHaveLength(1);
  });

  it("excludes an all-day event from a previous day", () => {
    const allDayYesterday = makeEvent({
      startsAt: at("2026-07-07", "00:00"),
      endsAt: at("2026-07-07", "00:00"),
      allDay: true,
    });

    expect(buildAgenda([allDayYesterday], NOW)).toEqual([]);
  });

  it("shows a timed cross-midnight event once, under Today with its start-time label (issue #58)", () => {
    const crossMidnight = makeEvent({
      id: "cross-midnight",
      startsAt: at("2026-07-08", "23:45"),
      endsAt: at("2026-07-09", "00:15"),
    });

    const groups = buildAgenda([crossMidnight], NOW);

    const occurrences = groups.flatMap((g) =>
      g.items.filter((i) => i.event.id === "cross-midnight")
    );
    expect(occurrences).toHaveLength(1);
    expect(groups[0].label).toBe("Today");
    expect(groups[0].items.map((i) => i.event.id)).toEqual(["cross-midnight"]);
    expect(groups[0].items[0].timeLabel).toBe("23:45");
  });

  it("shows a timed event ending exactly at midnight once, under Today", () => {
    const endsAtMidnight = makeEvent({
      id: "ends-midnight",
      startsAt: at("2026-07-08", "22:00"),
      endsAt: at("2026-07-09", "00:00"),
    });

    const groups = buildAgenda([endsAtMidnight], NOW);

    const occurrences = groups.flatMap((g) =>
      g.items.filter((i) => i.event.id === "ends-midnight")
    );
    expect(occurrences).toHaveLength(1);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Today");
  });

  it("shows a timed event in progress since yesterday once, under Today, labeled 'Now'", () => {
    const now = at("2026-07-08", "00:30");
    const overnight = makeEvent({
      id: "overnight",
      startsAt: at("2026-07-07", "23:00"),
      endsAt: at("2026-07-08", "01:00"),
    });

    const groups = buildAgenda([overnight], now);

    const occurrences = groups.flatMap((g) =>
      g.items.filter((i) => i.event.id === "overnight")
    );
    expect(occurrences).toHaveLength(1);
    expect(groups[0].label).toBe("Today");
    expect(groups[0].items[0].timeLabel).toBe("Now");
    expect(groups[0].items[0].inProgress).toBe(true);
  });

  it("shows a timed event starting tomorrow and ending the day after once, under Tomorrow", () => {
    const tomorrowNight = makeEvent({
      id: "tomorrow-night",
      startsAt: at("2026-07-09", "23:30"),
      endsAt: at("2026-07-10", "00:30"),
    });

    const groups = buildAgenda([tomorrowNight], NOW);

    const occurrences = groups.flatMap((g) =>
      g.items.filter((i) => i.event.id === "tomorrow-night")
    );
    expect(occurrences).toHaveLength(1);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Tomorrow");
    expect(groups[0].items[0].timeLabel).toBe("23:30");
  });

  it("counts a cross-midnight timed event as a single row against maxItems", () => {
    const crossMidnight = makeEvent({
      id: "cross-midnight",
      startsAt: at("2026-07-08", "23:45"),
      endsAt: at("2026-07-09", "00:15"),
    });
    const tomorrowEvents = Array.from({ length: 3 }, (_, i) =>
      makeEvent({
        id: `tomorrow-${i}`,
        startsAt: at("2026-07-09", `${String(9 + i).padStart(2, "0")}:00`),
        endsAt: at("2026-07-09", `${String(9 + i).padStart(2, "0")}:30`),
      })
    );

    const groups = buildAgenda([crossMidnight, ...tomorrowEvents], NOW, 2);
    const rows = groups.flatMap((g) => g.items.map((i) => i.event.id));

    // The cross-midnight event takes exactly one of the two slots (Today),
    // leaving one for Tomorrow — not two slots via a duplicated row.
    expect(rows).toEqual(["cross-midnight", "tomorrow-0"]);
  });

  it("shows a multi-day all-day event once per day bucket it covers", () => {
    const spanning = makeEvent({
      id: "spanning",
      startsAt: at("2026-07-08", "00:00"),
      endsAt: at("2026-07-09", "00:00"),
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
        startsAt: at("2026-07-08", `${String(13 + i).padStart(2, "0")}:00`),
        endsAt: at("2026-07-08", `${String(13 + i).padStart(2, "0")}:30`),
      })
    );
    const tomorrowEvents = Array.from({ length: 5 }, (_, i) =>
      makeEvent({
        id: `tomorrow-${i}`,
        startsAt: at("2026-07-09", `${String(9 + i).padStart(2, "0")}:00`),
        endsAt: at("2026-07-09", `${String(9 + i).padStart(2, "0")}:30`),
      })
    );

    const groups = buildAgenda([...events, ...tomorrowEvents], NOW, 3);
    const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

    expect(totalItems).toBe(3);
  });

  it("drops an empty day bucket entirely rather than rendering a headerless gap", () => {
    const tomorrowOnly = makeEvent({
      startsAt: at("2026-07-09", "09:00"),
      endsAt: at("2026-07-09", "10:00"),
    });

    const groups = buildAgenda([tomorrowOnly], NOW);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Tomorrow");
  });
});
