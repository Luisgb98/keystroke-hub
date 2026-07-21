// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { DailyLog, DailyLogItem } from "@/lib/db/schema";

import {
  buildWeekSummary,
  formatWeekSummaryMarkdown,
  type WeekDayInput,
  type WeekReviewInput,
} from "./week-summary";

let idCounter = 0;

function item(overrides: Partial<DailyLogItem> = {}): DailyLogItem {
  idCounter += 1;
  return {
    id: `item-${idCounter}`,
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

const WEEK_START = "2026-07-06";
const DAYS = [
  "2026-07-06",
  "2026-07-07",
  "2026-07-08",
  "2026-07-09",
  "2026-07-10",
  "2026-07-11",
  "2026-07-12",
];

function emptyWeek(): WeekDayInput[] {
  return DAYS.map((date) => ({ date, log: null, items: [] }));
}

function review(overrides: Partial<WeekReviewInput> = {}): WeekReviewInput {
  return {
    highlights: null,
    rating: null,
    wentWell: null,
    drainedMe: null,
    changeNext: null,
    ...overrides,
  };
}

describe("buildWeekSummary", () => {
  it("groups done items by day, sorted by position", () => {
    const days = emptyWeek();
    days[0] = {
      date: DAYS[0],
      log: null,
      items: [
        item({ title: "Second", status: "done", position: 1 }),
        item({ title: "First", status: "done", position: 0 }),
        item({ title: "Still planned", status: "planned", position: 2 }),
      ],
    };

    const summary = buildWeekSummary(WEEK_START, days, null);

    expect(summary.doneByDay[0].done.map((i) => i.title)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("is empty when no day has any data and there are no highlights", () => {
    const summary = buildWeekSummary(WEEK_START, emptyWeek(), null);
    expect(summary.isEmpty).toBe(true);
  });

  it("is not empty when only highlights are set", () => {
    const summary = buildWeekSummary(
      WEEK_START,
      emptyWeek(),
      review({ highlights: "Shipped the release" })
    );
    expect(summary.isEmpty).toBe(false);
    expect(summary.highlights).toBe("Shipped the release");
  });

  it("collects retros with their mood, only for days that have one", () => {
    const days = emptyWeek();
    days[0] = {
      date: DAYS[0],
      log: log({ logDate: DAYS[0], retro: "Good day", mood: 4 }),
      items: [],
    };
    days[1] = {
      date: DAYS[1],
      log: log({ logDate: DAYS[1], retro: null, mood: 2 }),
      items: [],
    };

    const summary = buildWeekSummary(WEEK_START, days, null);

    expect(summary.retros).toEqual([
      { date: DAYS[0], retro: "Good day", mood: 4 },
    ]);
  });

  it("does not carry over a chain whose final copy is done, within the same week", () => {
    const mon = item({ title: "Ship it", status: "rolled_over" });
    const tue = item({ title: "Ship it", status: "done" });
    mon.rolledOverToId = tue.id;

    const days = emptyWeek();
    days[0] = { date: DAYS[0], log: null, items: [mon] };
    days[1] = { date: DAYS[1], log: null, items: [tue] };

    const summary = buildWeekSummary(WEEK_START, days, null);

    expect(summary.carriedOver).toEqual([]);
    expect(summary.doneByDay[1].done.map((i) => i.title)).toEqual(["Ship it"]);
  });

  it("collapses a multi-day chain into a single carried-over entry, attributed to its first day", () => {
    const mon = item({ title: "Write the docs", status: "rolled_over" });
    const tue = item({ title: "Write the docs", status: "rolled_over" });
    const wed = item({ title: "Write the docs", status: "planned" });
    mon.rolledOverToId = tue.id;
    tue.rolledOverToId = wed.id;

    const days = emptyWeek();
    days[0] = { date: DAYS[0], log: null, items: [mon] };
    days[1] = { date: DAYS[1], log: null, items: [tue] };
    days[2] = { date: DAYS[2], log: null, items: [wed] };

    const summary = buildWeekSummary(WEEK_START, days, null);

    expect(summary.carriedOver).toEqual([
      { id: mon.id, title: "Write the docs", firstAppearedDate: DAYS[0] },
    ]);
  });

  it("treats a chain that exits the week (rolled to a day outside the fetched range) as carried over", () => {
    const fri = item({ title: "Ship the release", status: "rolled_over" });
    fri.rolledOverToId = "outside-the-week-id";

    const days = emptyWeek();
    days[4] = { date: DAYS[4], log: null, items: [fri] };

    const summary = buildWeekSummary(WEEK_START, days, null);

    expect(summary.carriedOver).toEqual([
      { id: fri.id, title: "Ship the release", firstAppearedDate: DAYS[4] },
    ]);
  });

  it("treats an item rolled over from before the fetched week as first-appearing on the day it's seen", () => {
    // Simulates a copy whose source (from last week) was never fetched: it
    // has no in-week predecessor, so it's a root on the day it appears here.
    const carriedIn = item({ title: "Old business", status: "planned" });

    const days = emptyWeek();
    days[0] = { date: DAYS[0], log: null, items: [carriedIn] };

    const summary = buildWeekSummary(WEEK_START, days, null);

    expect(summary.carriedOver).toEqual([
      { id: carriedIn.id, title: "Old business", firstAppearedDate: DAYS[0] },
    ]);
  });

  it("is null-safe when a rolled-over item's target was deleted (rolledOverToId reset to null)", () => {
    const orphan = item({
      title: "Orphaned",
      status: "rolled_over",
      rolledOverToId: null,
    });

    const days = emptyWeek();
    days[0] = { date: DAYS[0], log: null, items: [orphan] };

    const summary = buildWeekSummary(WEEK_START, days, null);

    expect(summary.carriedOver).toEqual([
      { id: orphan.id, title: "Orphaned", firstAppearedDate: DAYS[0] },
    ]);
  });

  it("counts an item rolled over multiple times only once even though each hop appears in the week", () => {
    const mon = item({ title: "Recurring task", status: "rolled_over" });
    const tue = item({ title: "Recurring task", status: "rolled_over" });
    const wed = item({ title: "Recurring task", status: "rolled_over" });
    const thu = item({ title: "Recurring task", status: "planned" });
    mon.rolledOverToId = tue.id;
    tue.rolledOverToId = wed.id;
    wed.rolledOverToId = thu.id;

    const days = emptyWeek();
    days[0] = { date: DAYS[0], log: null, items: [mon] };
    days[1] = { date: DAYS[1], log: null, items: [tue] };
    days[2] = { date: DAYS[2], log: null, items: [wed] };
    days[3] = { date: DAYS[3], log: null, items: [thu] };

    const summary = buildWeekSummary(WEEK_START, days, null);

    expect(summary.carriedOver).toHaveLength(1);
    expect(summary.carriedOver[0].firstAppearedDate).toBe(DAYS[0]);
  });
});

describe("formatWeekSummaryMarkdown", () => {
  it("renders a full week with highlights, done days, retros, and carried-over items", () => {
    const days = emptyWeek();
    days[0] = {
      date: DAYS[0],
      log: log({ logDate: DAYS[0], retro: "Solid start", mood: 4 }),
      items: [item({ title: "Shipped the thing", status: "done" })],
    };
    const stuck = item({ title: "Stuck task", status: "planned" });
    days[1] = { date: DAYS[1], log: null, items: [stuck] };

    const summary = buildWeekSummary(
      WEEK_START,
      days,
      review({ highlights: "Big week for the release." })
    );
    const markdown = formatWeekSummaryMarkdown(summary);

    expect(markdown).toContain("Big week for the release.");
    expect(markdown).toContain("Shipped the thing");
    expect(markdown).toContain("Solid start");
    expect(markdown).toContain("Good");
    expect(markdown).toContain("Stuck task");
  });

  it("renders placeholders for an empty week", () => {
    const summary = buildWeekSummary(WEEK_START, emptyWeek(), null);
    const markdown = formatWeekSummaryMarkdown(summary);

    expect(markdown).toContain("No highlights yet.");
    expect(markdown).toContain("Nothing logged.");
    expect(markdown).not.toContain("Retros");
    expect(markdown).not.toContain("Carried over");
  });
});
