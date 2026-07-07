import { afterEach, describe, expect, it } from "vitest";

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

const originalTz = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTz;
});

describe("getVisibleRange", () => {
  it("day: spans exactly one calendar day", () => {
    const { from, to } = getVisibleRange(
      "day",
      new Date("2026-07-08T15:00:00")
    );
    expect(from.toDateString()).toBe(
      new Date("2026-07-08T00:00:00").toDateString()
    );
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("week: starts on Monday and spans 7 days", () => {
    // 2026-07-08 is a Wednesday.
    const { from, to } = getVisibleRange(
      "week",
      new Date("2026-07-08T15:00:00")
    );
    expect(from.getDay()).toBe(1); // Monday
    expect(from.toDateString()).toBe(
      new Date("2026-07-06T00:00:00").toDateString()
    );
    expect(to.toDateString()).toBe(
      new Date("2026-07-13T00:00:00").toDateString()
    );
  });

  it("month: produces a 42-day grid starting on a Monday", () => {
    const { from, to } = getVisibleRange("month", new Date("2026-07-08"));
    expect(from.getDay()).toBe(1);
    expect((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)).toBe(42);
  });

  it("month: grid start falls in June when July 1 is not a Monday", () => {
    // July 1 2026 is a Wednesday, so the grid must spill into June.
    const { from } = getVisibleRange("month", new Date("2026-07-01"));
    expect(from.getMonth()).toBe(5); // June
  });
});

describe("getMonthGridDays", () => {
  it("returns 42 consecutive days", () => {
    const days = getMonthGridDays(new Date("2026-07-08"));
    expect(days).toHaveLength(42);
    for (let i = 1; i < days.length; i++) {
      expect(days[i].getTime() - days[i - 1].getTime()).toBe(
        24 * 60 * 60 * 1000
      );
    }
  });

  it("covers every day of the anchor month", () => {
    const days = getMonthGridDays(new Date("2026-02-15"));
    const februaryDays = days.filter((d) => d.getMonth() === 1);
    expect(februaryDays).toHaveLength(28); // 2026 is not a leap year
  });

  it("handles a leap-year February", () => {
    const days = getMonthGridDays(new Date("2028-02-15"));
    const februaryDays = days.filter((d) => d.getMonth() === 1);
    expect(februaryDays).toHaveLength(29);
  });

  it("handles the December -> January year boundary", () => {
    const days = getMonthGridDays(new Date("2026-12-15"));
    const years = new Set(days.map((d) => d.getFullYear()));
    expect(years.has(2026)).toBe(true);
    expect(years.has(2027)).toBe(true);
  });
});

describe("getWeekDays", () => {
  it("returns 7 consecutive days starting Monday", () => {
    const days = getWeekDays(new Date("2026-07-10")); // Friday
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1);
    expect(days[6].getDay()).toBe(0);
  });

  it("is stable across a DST transition", () => {
    process.env.TZ = "America/New_York";
    // 2026-03-08 is when US DST begins (spring forward).
    const days = getWeekDays(new Date("2026-03-10"));
    expect(days).toHaveLength(7);
    expect(new Set(days.map((d) => d.getDay())).size).toBe(7);
  });

  it("is stable across a fall-back DST transition", () => {
    process.env.TZ = "America/New_York";
    // 2026-11-01 is when US DST ends (fall back).
    const days = getWeekDays(new Date("2026-11-03"));
    expect(days).toHaveLength(7);
    expect(new Set(days.map((d) => d.getDay())).size).toBe(7);
  });
});

describe("shiftDate", () => {
  it("day: moves by one day", () => {
    const next = shiftDate("day", new Date("2026-07-08"), 1);
    expect(next.toDateString()).toBe(new Date("2026-07-09").toDateString());
  });

  it("week: moves by seven days", () => {
    const prev = shiftDate("week", new Date("2026-07-08"), -1);
    expect(prev.toDateString()).toBe(new Date("2026-07-01").toDateString());
  });

  it("month: moves to the 1st of the adjacent month without drifting from month-end anchors", () => {
    const first = shiftDate("month", new Date("2026-01-31"), 1);
    expect(first.getMonth()).toBe(1); // February
    expect(first.getDate()).toBe(1);

    const second = shiftDate("month", first, 1);
    expect(second.getMonth()).toBe(2); // March, not drifted to April
    expect(second.getDate()).toBe(1);
  });
});

describe("formatRangeLabel", () => {
  it("day: full weekday + date", () => {
    expect(formatRangeLabel("day", new Date("2026-07-08"))).toBe(
      "Wednesday, July 8, 2026"
    );
  });

  it("week: condensed range within the same month", () => {
    expect(formatRangeLabel("week", new Date("2026-07-08"))).toBe(
      "Jul 6–12, 2026"
    );
  });

  it("week: spans two months", () => {
    expect(formatRangeLabel("week", new Date("2026-07-30"))).toBe(
      "Jul 27 – Aug 2, 2026"
    );
  });

  it("week: spans two years", () => {
    expect(formatRangeLabel("week", new Date("2026-12-31"))).toBe(
      "Dec 28, 2026 – Jan 3, 2027"
    );
  });

  it("month: month + year", () => {
    expect(formatRangeLabel("month", new Date("2026-07-08"))).toBe("July 2026");
  });
});

describe("date param helpers", () => {
  it("round-trips a date through formatDateParam/parseDateParam", () => {
    const date = new Date("2026-07-08");
    expect(parseDateParam(formatDateParam(date)).toDateString()).toBe(
      date.toDateString()
    );
  });

  it("parseDateParam falls back to today for missing/invalid values", () => {
    const today = new Date();
    expect(parseDateParam(undefined).toDateString()).toBe(today.toDateString());
    expect(parseDateParam("not-a-date").toDateString()).toBe(
      today.toDateString()
    );
  });

  it("parseViewParam falls back to week for missing/invalid values", () => {
    expect(parseViewParam("day")).toBe("day");
    expect(parseViewParam("month")).toBe("month");
    expect(parseViewParam(undefined)).toBe("week");
    expect(parseViewParam("year")).toBe("week");
  });
});
