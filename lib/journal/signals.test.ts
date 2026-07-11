// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { DailyLog, DailyLogItem } from "@/lib/db/schema";

import { buildWeekSignals, weekSignalSentences } from "./signals";
import type {
  CarriedOverItem,
  WeekDayInput,
  WeekDaySummary,
} from "./week-summary";

const DAYS = [
  "2026-07-06",
  "2026-07-07",
  "2026-07-08",
  "2026-07-09",
  "2026-07-10",
  "2026-07-11",
  "2026-07-12",
];

function log(overrides: Partial<DailyLog> = {}): DailyLog {
  return {
    id: "log-x",
    logDate: "2026-07-06",
    retro: null,
    mood: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function item(overrides: Partial<DailyLogItem> = {}): DailyLogItem {
  return {
    id: "item-x",
    logId: "log-1",
    title: "Do the thing",
    status: "planned",
    rolledOverToId: null,
    position: 0,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function emptyWeek(): WeekDayInput[] {
  return DAYS.map((date) => ({ date, log: null, items: [] }));
}

function emptyDoneByDay(): WeekDaySummary[] {
  return DAYS.map((date) => ({ date, done: [] }));
}

describe("buildWeekSignals", () => {
  it("is all zero for a week with no data at all", () => {
    const signals = buildWeekSignals(emptyWeek(), {
      doneByDay: emptyDoneByDay(),
      carriedOver: [],
    });

    expect(signals).toEqual({
      weekdaysLogged: 0,
      weekdayCount: 5,
      doneCount: 0,
      trackedCount: 0,
      carriedOverCount: 0,
    });
  });

  it("counts a day as logged when it has a log row, even with no items", () => {
    const days = emptyWeek();
    days[0] = { date: DAYS[0], log: log({ logDate: DAYS[0] }), items: [] };

    const signals = buildWeekSignals(days, {
      doneByDay: emptyDoneByDay(),
      carriedOver: [],
    });

    expect(signals.weekdaysLogged).toBe(1);
  });

  it("only counts weekdays (Mon-Fri) toward weekdaysLogged, ignoring weekend activity", () => {
    const days = emptyWeek();
    days[5] = { date: DAYS[5], log: log({ logDate: DAYS[5] }), items: [] }; // Saturday
    days[6] = { date: DAYS[6], log: log({ logDate: DAYS[6] }), items: [] }; // Sunday

    const signals = buildWeekSignals(days, {
      doneByDay: emptyDoneByDay(),
      carriedOver: [],
    });

    expect(signals.weekdaysLogged).toBe(0);
    expect(signals.weekdayCount).toBe(5);
  });

  it("counts partial-week activity", () => {
    const days = emptyWeek();
    days[0] = { date: DAYS[0], log: log(), items: [] };
    days[2] = { date: DAYS[2], log: null, items: [item()] };

    const signals = buildWeekSignals(days, {
      doneByDay: emptyDoneByDay(),
      carriedOver: [],
    });

    expect(signals.weekdaysLogged).toBe(2);
  });

  it("sums done items across the week for doneCount", () => {
    const doneByDay: WeekDaySummary[] = emptyDoneByDay();
    doneByDay[0] = { date: DAYS[0], done: [{ id: "i-1", title: "A" }] };
    doneByDay[1] = {
      date: DAYS[1],
      done: [
        { id: "i-2", title: "B" },
        { id: "i-3", title: "C" },
      ],
    };

    const signals = buildWeekSignals(emptyWeek(), {
      doneByDay,
      carriedOver: [],
    });

    expect(signals.doneCount).toBe(3);
    expect(signals.trackedCount).toBe(3);
  });

  it("reuses carriedOver for carriedOverCount and folds it into trackedCount", () => {
    const carriedOver: CarriedOverItem[] = [
      { id: "i-1", title: "Stuck", firstAppearedDate: DAYS[0] },
      { id: "i-2", title: "Also stuck", firstAppearedDate: DAYS[1] },
    ];

    const signals = buildWeekSignals(emptyWeek(), {
      doneByDay: emptyDoneByDay(),
      carriedOver,
    });

    expect(signals.carriedOverCount).toBe(2);
    expect(signals.doneCount).toBe(0);
    expect(signals.trackedCount).toBe(2);
  });

  it("combines done and carried-over items into trackedCount", () => {
    const doneByDay: WeekDaySummary[] = emptyDoneByDay();
    doneByDay[0] = { date: DAYS[0], done: [{ id: "i-1", title: "A" }] };
    const carriedOver: CarriedOverItem[] = [
      { id: "i-2", title: "Stuck", firstAppearedDate: DAYS[1] },
    ];

    const signals = buildWeekSignals(emptyWeek(), { doneByDay, carriedOver });

    expect(signals.trackedCount).toBe(2);
  });
});

describe("weekSignalSentences", () => {
  it("returns a single friendly line for a week with nothing logged", () => {
    const sentences = weekSignalSentences({
      weekdaysLogged: 0,
      weekdayCount: 5,
      doneCount: 0,
      trackedCount: 0,
      carriedOverCount: 0,
    });

    expect(sentences).toEqual(["Nothing logged yet this week."]);
  });

  it("omits the tracked-items sentence when a day is logged but nothing is tracked yet (e.g. retro-only)", () => {
    const sentences = weekSignalSentences({
      weekdaysLogged: 1,
      weekdayCount: 5,
      doneCount: 0,
      trackedCount: 0,
      carriedOverCount: 0,
    });

    expect(sentences).toEqual(["You logged 1 of 5 weekdays."]);
  });

  it("includes the done-ratio sentence once anything is tracked, with no division by zero", () => {
    const sentences = weekSignalSentences({
      weekdaysLogged: 3,
      weekdayCount: 5,
      doneCount: 8,
      trackedCount: 11,
      carriedOverCount: 3,
    });

    expect(sentences).toEqual([
      "You logged 3 of 5 weekdays.",
      "8 of 11 items logged this week got done.",
      "3 items still carrying over.",
    ]);
  });

  it("uses the singular for exactly one carried-over item", () => {
    const sentences = weekSignalSentences({
      weekdaysLogged: 5,
      weekdayCount: 5,
      doneCount: 4,
      trackedCount: 5,
      carriedOverCount: 1,
    });

    expect(sentences).toContain("1 item still carrying over.");
  });

  it("omits the carried-over sentence when everything tracked is done (all-done week)", () => {
    const sentences = weekSignalSentences({
      weekdaysLogged: 5,
      weekdayCount: 5,
      doneCount: 5,
      trackedCount: 5,
      carriedOverCount: 0,
    });

    expect(sentences.some((s) => s.includes("carrying over"))).toBe(false);
  });

  it("handles an all-carried-over week (nothing done yet)", () => {
    const sentences = weekSignalSentences({
      weekdaysLogged: 2,
      weekdayCount: 5,
      doneCount: 0,
      trackedCount: 4,
      carriedOverCount: 4,
    });

    expect(sentences).toEqual([
      "You logged 2 of 5 weekdays.",
      "0 of 4 items logged this week got done.",
      "4 items still carrying over.",
    ]);
  });
});
