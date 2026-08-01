import { describe, expect, it } from "vitest";

import { appTodayParam, formatInAppZone } from "@/lib/time";

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

/**
 * Runs under `TZ=UTC` (vitest.config.ts) while the app zone is Europe/Madrid.
 * Journal dates are `yyyy-MM-dd` strings, so the parse/format round trip was
 * always symmetric — the real bug was `todayParam()` resolving "today" in the
 * server's zone, which on Vercel rolled the journal over two hours early and
 * disagreed with `DayHeader`'s browser-side "today" in that window (#95).
 */

describe("formatDateParam / todayParam", () => {
  it("formats a Date as yyyy-MM-dd", () => {
    expect(formatDateParam(new Date("2026-07-08T15:00:00Z"))).toBe(
      "2026-07-08"
    );
  });

  it("todayParam matches today in the app zone, not the server's", () => {
    expect(todayParam()).toBe(appTodayParam());
    expect(todayParam()).toBe(formatInAppZone(new Date(), "yyyy-MM-dd"));
  });

  it("formats an instant onto the app-zone day it belongs to", () => {
    // 22:30Z on Jul 31 is already 00:30 on Aug 1 in Madrid. Under the old
    // server-local resolution the journal called this "2026-07-31".
    expect(formatDateParam(new Date("2026-07-31T22:30:00Z"))).toBe(
      "2026-08-01"
    );
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
