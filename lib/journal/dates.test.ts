import { afterEach, describe, expect, it } from "vitest";

import {
  formatDateParam,
  formatDayLabel,
  formatShortDayLabel,
  isTodayParam,
  isValidDateParam,
  parseDateParam,
  shiftDateParam,
  todayParam,
} from "./dates";

const originalTz = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTz;
});

describe("formatDateParam / todayParam", () => {
  it("formats a Date as yyyy-MM-dd", () => {
    expect(formatDateParam(new Date("2026-07-08T15:00:00"))).toBe("2026-07-08");
  });

  it("todayParam matches the current local date", () => {
    expect(todayParam()).toBe(formatDateParam(new Date()));
  });
});

describe("isValidDateParam", () => {
  it("accepts a well-formed date", () => {
    expect(isValidDateParam("2026-07-08")).toBe(true);
  });

  it("rejects malformed or nonsense strings", () => {
    expect(isValidDateParam("not-a-date")).toBe(false);
    expect(isValidDateParam("2026-7-8")).toBe(false);
    expect(isValidDateParam("")).toBe(false);
  });
});

describe("parseDateParam", () => {
  it("passes through a valid value", () => {
    expect(parseDateParam("2026-07-08")).toBe("2026-07-08");
  });

  it("falls back to today for missing/invalid values", () => {
    expect(parseDateParam(undefined)).toBe(todayParam());
    expect(parseDateParam("nope")).toBe(todayParam());
  });
});

describe("shiftDateParam", () => {
  it("moves forward and backward by one day", () => {
    expect(shiftDateParam("2026-07-08", 1)).toBe("2026-07-09");
    expect(shiftDateParam("2026-07-08", -1)).toBe("2026-07-07");
  });

  it("crosses a month boundary", () => {
    expect(shiftDateParam("2026-07-31", 1)).toBe("2026-08-01");
  });

  it("crosses a year boundary", () => {
    expect(shiftDateParam("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("is stable across a DST transition", () => {
    process.env.TZ = "America/New_York";
    // 2026-03-08 is when US DST begins (spring forward).
    expect(shiftDateParam("2026-03-07", 1)).toBe("2026-03-08");
    expect(shiftDateParam("2026-03-08", 1)).toBe("2026-03-09");
  });
});

describe("isTodayParam", () => {
  it("is true for today and false otherwise", () => {
    expect(isTodayParam(todayParam())).toBe(true);
    expect(isTodayParam(shiftDateParam(todayParam(), -1))).toBe(false);
  });
});

describe("labels", () => {
  it("formats the full day label", () => {
    expect(formatDayLabel("2026-07-08")).toBe("Wednesday, July 8, 2026");
  });

  it("formats the short day label", () => {
    expect(formatShortDayLabel("2026-07-08")).toBe("Jul 8");
  });
});
