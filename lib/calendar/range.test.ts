import { describe, expect, it } from "vitest";

import { formatInAppZone } from "@/lib/time";

import {
  formatDateParam,
  formatRangeLabel,
  getMonthGridDays,
  getVisibleRange,
  getWeekDays,
  parseDateParam,
  parseViewParam,
  shiftDate,
} from "./range";

/**
 * The suite runs with `TZ=UTC` (vitest.config.ts) — what Vercel and CI use —
 * while the app's zone is Europe/Madrid, so these assertions only pass if the
 * boundaries are computed in the app zone rather than the process's.
 *
 * Assertions deliberately avoid `new Date("2026-07-06T00:00:00")`: that
 * re-parses the same wall-clock string the code under test parses, so it
 * agrees with the code in *every* timezone and could never catch a shift
 * (issue #95). Instead: absolute `…Z` instants, or the app-zone rendering.
 */

/** The app-zone calendar day an instant falls on. */
function appDay(date: Date): string {
  return formatInAppZone(date, "yyyy-MM-dd");
}

describe("getVisibleRange", () => {
  it("day: spans exactly one calendar day anchored at app-zone midnight", () => {
    const { from, to } = getVisibleRange(
      "day",
      new Date("2026-07-08T15:00:00Z")
    );
    // Madrid is UTC+2 in July, so the day starts at 22:00Z the evening before.
    expect(from.toISOString()).toBe("2026-07-07T22:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-08T22:00:00.000Z");
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("day: a 00:30 app-zone event belongs to that day, not the previous one", () => {
    // 2026-07-08T22:30Z is 2026-07-09 00:30 in Madrid.
    const justAfterMidnight = new Date("2026-07-08T22:30:00Z");
    const { from, to } = getVisibleRange("day", justAfterMidnight);
    expect(appDay(from)).toBe("2026-07-09");
    expect(justAfterMidnight >= from && justAfterMidnight < to).toBe(true);
  });

  it("week: starts on Monday and spans 7 days", () => {
    // 2026-07-08 is a Wednesday.
    const { from, to } = getVisibleRange(
      "week",
      new Date("2026-07-08T15:00:00Z")
    );
    expect(appDay(from)).toBe("2026-07-06");
    expect(formatInAppZone(from, "EEEE")).toBe("Monday");
    expect(appDay(to)).toBe("2026-07-13");
    expect(to.getTime() - from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("month: produces a 42-day grid starting on a Monday", () => {
    const { from, to } = getVisibleRange(
      "month",
      new Date("2026-07-08T12:00:00Z")
    );
    expect(formatInAppZone(from, "EEEE")).toBe("Monday");
    expect((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)).toBe(42);
  });

  it("month: grid start falls in June when July 1 is not a Monday", () => {
    // July 1 2026 is a Wednesday, so the grid must spill into June.
    const { from } = getVisibleRange("month", new Date("2026-07-01T12:00:00Z"));
    expect(formatInAppZone(from, "MMMM")).toBe("June");
  });
});

describe("getMonthGridDays", () => {
  it("returns 42 consecutive days", () => {
    const days = getMonthGridDays(new Date("2026-07-08T12:00:00Z"));
    expect(days).toHaveLength(42);
    for (let i = 1; i < days.length; i++) {
      expect(days[i].getTime() - days[i - 1].getTime()).toBe(
        24 * 60 * 60 * 1000
      );
    }
  });

  it("covers every day of the anchor month", () => {
    const days = getMonthGridDays(new Date("2026-02-15T12:00:00Z"));
    const februaryDays = days.filter(
      (d) => formatInAppZone(d, "MMMM") === "February"
    );
    expect(februaryDays).toHaveLength(28); // 2026 is not a leap year
  });

  it("handles a leap-year February", () => {
    const days = getMonthGridDays(new Date("2028-02-15T12:00:00Z"));
    const februaryDays = days.filter(
      (d) => formatInAppZone(d, "MMMM") === "February"
    );
    expect(februaryDays).toHaveLength(29);
  });

  it("handles the December -> January year boundary", () => {
    const days = getMonthGridDays(new Date("2026-12-15T12:00:00Z"));
    const years = new Set(days.map((d) => formatInAppZone(d, "yyyy")));
    expect(years).toEqual(new Set(["2026", "2027"]));
  });
});

describe("getWeekDays", () => {
  it("returns 7 consecutive days starting Monday, each at app-zone midnight", () => {
    const days = getWeekDays(new Date("2026-07-10T12:00:00Z")); // Friday
    expect(days).toHaveLength(7);
    expect(days.map(appDay)).toEqual([
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
    ]);
    expect(days.every((d) => formatInAppZone(d, "HH:mm") === "00:00")).toBe(
      true
    );
  });

  it("keeps every day at app-zone midnight across the spring-forward boundary", () => {
    // Madrid springs forward on 2026-03-29 (CET +1 -> CEST +2).
    const days = getWeekDays(new Date("2026-03-25T12:00:00Z"));
    expect(days.map(appDay)).toEqual([
      "2026-03-23",
      "2026-03-24",
      "2026-03-25",
      "2026-03-26",
      "2026-03-27",
      "2026-03-28",
      "2026-03-29",
    ]);
    expect(days.every((d) => formatInAppZone(d, "HH:mm") === "00:00")).toBe(
      true
    );
    // The offset really does change mid-week: 23:00Z under CET, 22:00Z under CEST.
    expect(days[0].toISOString()).toBe("2026-03-22T23:00:00.000Z");
    expect(days[6].toISOString()).toBe("2026-03-28T23:00:00.000Z");
  });

  it("keeps every day at app-zone midnight across the fall-back boundary", () => {
    // Madrid falls back on 2026-10-25 (CEST +2 -> CET +1).
    const days = getWeekDays(new Date("2026-10-21T12:00:00Z"));
    expect(days.map(appDay)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    expect(days.every((d) => formatInAppZone(d, "HH:mm") === "00:00")).toBe(
      true
    );
    expect(days[0].toISOString()).toBe("2026-10-18T22:00:00.000Z");
    expect(days[6].toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });
});

describe("shiftDate", () => {
  it("day: moves by one day", () => {
    const next = shiftDate("day", parseDateParam("2026-07-08"), 1);
    expect(appDay(next)).toBe("2026-07-09");
  });

  it("week: moves by seven days", () => {
    const prev = shiftDate("week", parseDateParam("2026-07-08"), -1);
    expect(appDay(prev)).toBe("2026-07-01");
  });

  it("month: moves to the 1st of the adjacent month without drifting from month-end anchors", () => {
    const first = shiftDate("month", parseDateParam("2026-01-31"), 1);
    expect(appDay(first)).toBe("2026-02-01");

    const second = shiftDate("month", first, 1);
    expect(appDay(second)).toBe("2026-03-01"); // March, not drifted to April
  });
});

describe("formatRangeLabel", () => {
  it("day: full weekday + date", () => {
    expect(formatRangeLabel("day", parseDateParam("2026-07-08"))).toBe(
      "Wednesday, July 8, 2026"
    );
  });

  it("week: condensed range within the same month", () => {
    expect(formatRangeLabel("week", parseDateParam("2026-07-08"))).toBe(
      "Jul 6–12, 2026"
    );
  });

  it("week: spans two months", () => {
    expect(formatRangeLabel("week", parseDateParam("2026-07-30"))).toBe(
      "Jul 27 – Aug 2, 2026"
    );
  });

  it("week: spans two years", () => {
    expect(formatRangeLabel("week", parseDateParam("2026-12-31"))).toBe(
      "Dec 28, 2026 – Jan 3, 2027"
    );
  });

  it("month: month + year", () => {
    expect(formatRangeLabel("month", parseDateParam("2026-07-08"))).toBe(
      "July 2026"
    );
  });
});

describe("date param helpers", () => {
  it("parses a date param to app-zone midnight, not the server's", () => {
    // Under TZ=UTC the old `new Date("2026-07-08T00:00:00")` produced
    // 2026-07-08T00:00Z, which renders as 02:00 on the 8th in Madrid.
    expect(parseDateParam("2026-07-08").toISOString()).toBe(
      "2026-07-07T22:00:00.000Z"
    );
  });

  it("round-trips a date through formatDateParam/parseDateParam", () => {
    for (const day of [
      "2026-01-15",
      "2026-03-29",
      "2026-07-08",
      "2026-10-25",
    ]) {
      expect(formatDateParam(parseDateParam(day))).toBe(day);
    }
  });

  it("rejects a well-formed but nonexistent day, falling back to today", () => {
    expect(formatDateParam(parseDateParam("2026-02-30"))).toBe(
      formatDateParam(new Date())
    );
  });

  it("parseDateParam falls back to today for missing/invalid values", () => {
    const today = formatDateParam(new Date());
    expect(formatDateParam(parseDateParam(undefined))).toBe(today);
    expect(formatDateParam(parseDateParam("not-a-date"))).toBe(today);
  });

  it("parseViewParam falls back to week for missing/invalid values", () => {
    expect(parseViewParam("day")).toBe("day");
    expect(parseViewParam("month")).toBe("month");
    expect(parseViewParam(undefined)).toBe("week");
    expect(parseViewParam("year")).toBe("week");
  });
});
