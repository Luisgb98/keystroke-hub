import { describe, expect, it } from "vitest";

import {
  currentWeekParam,
  formatWeekLabel,
  isCurrentWeekParam,
  parseWeekParam,
  shiftWeekParam,
  weekDayParams,
  weekStartParam,
} from "./week-dates";

describe("weekStartParam", () => {
  it("normalizes a mid-week date to its Monday", () => {
    expect(weekStartParam("2026-07-08")).toBe("2026-07-06"); // Wednesday -> Monday
  });

  it("normalizes a Sunday to the Monday that starts its week", () => {
    expect(weekStartParam("2026-07-12")).toBe("2026-07-06");
  });

  it("is a no-op for a Monday", () => {
    expect(weekStartParam("2026-07-06")).toBe("2026-07-06");
  });
});

describe("parseWeekParam", () => {
  it("normalizes a valid value to its Monday", () => {
    expect(parseWeekParam("2026-07-08")).toBe("2026-07-06");
  });

  it("falls back to the current week for missing/invalid values", () => {
    expect(parseWeekParam(undefined)).toBe(currentWeekParam());
    expect(parseWeekParam("nope")).toBe(currentWeekParam());
  });
});

describe("shiftWeekParam", () => {
  it("moves forward and backward by one week", () => {
    expect(shiftWeekParam("2026-07-06", 1)).toBe("2026-07-13");
    expect(shiftWeekParam("2026-07-06", -1)).toBe("2026-06-29");
  });

  it("crosses a year boundary", () => {
    expect(shiftWeekParam("2025-12-29", 1)).toBe("2026-01-05");
  });
});

describe("isCurrentWeekParam", () => {
  it("is true for the current week and false otherwise", () => {
    expect(isCurrentWeekParam(currentWeekParam())).toBe(true);
    expect(isCurrentWeekParam(shiftWeekParam(currentWeekParam(), -1))).toBe(
      false
    );
  });
});

describe("weekDayParams", () => {
  it("returns the 7 Monday-start days", () => {
    expect(weekDayParams("2026-07-06")).toEqual([
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
    ]);
  });
});

describe("formatWeekLabel", () => {
  it("formats a week within the same month", () => {
    expect(formatWeekLabel("2026-07-06")).toBe("Jul 6–12, 2026");
  });

  it("formats a week spanning two months", () => {
    expect(formatWeekLabel("2026-07-27")).toBe("Jul 27 – Aug 2, 2026");
  });

  it("formats a week spanning two years", () => {
    expect(formatWeekLabel("2025-12-29")).toBe("Dec 29, 2025 – Jan 4, 2026");
  });
});
