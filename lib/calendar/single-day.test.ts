import { describe, expect, it } from "vitest";

import { formatAppDateParam, formatAppTimeParam } from "@/lib/time";

import {
  SINGLE_DAY_MESSAGE,
  clampToStartDay,
  endOfStartDay,
  isSingleAppDay,
  isSingleDayKind,
} from "./single-day";

// The process runs in UTC while the app zone is Europe/Madrid (see
// vitest.config.ts) — the same server/app split production has, so "same day"
// is asserted in wall-clock terms, never by re-parsing the string that
// produced the instant.

describe("isSingleDayKind", () => {
  it("covers both content-world kinds and spares work", () => {
    expect(isSingleDayKind("content")).toBe(true);
    expect(isSingleDayKind("stream")).toBe(true);
    // Meetings, trips and multi-day work items are real.
    expect(isSingleDayKind("work")).toBe(false);
  });
});

describe("isSingleAppDay", () => {
  it("accepts a span inside one app-timezone day", () => {
    expect(
      isSingleAppDay(
        new Date("2026-08-07T17:00:00Z"),
        new Date("2026-08-07T19:00:00Z")
      )
    ).toBe(true);
  });

  it("rejects the midnight-spanning default the editor used to produce", () => {
    // 23:00 Madrid → 00:00 the next day: the exact state #115 exists to make
    // unrepresentable.
    expect(
      isSingleAppDay(
        new Date("2026-08-07T21:00:00Z"),
        new Date("2026-08-07T22:00:00Z")
      )
    ).toBe(false);
  });

  it("judges the day in the app zone, not the server's", () => {
    // 21:30 → 22:30 UTC is one UTC day (Aug 7) and two Madrid days (23:30 on
    // the 7th → 00:30 on the 8th). The app zone is the one that counts.
    expect(
      isSingleAppDay(
        new Date("2026-08-07T21:30:00Z"),
        new Date("2026-08-07T22:30:00Z")
      )
    ).toBe(false);
  });
});

describe("endOfStartDay", () => {
  it("lands on 23:59 of the start's app-timezone day", () => {
    const end = endOfStartDay(new Date("2026-08-07T17:00:00Z"));
    expect(formatAppDateParam(end)).toBe("2026-08-07");
    expect(formatAppTimeParam(end)).toBe("23:59");
  });

  it("never returns midnight of the next day", () => {
    // That instant reads as a different wall-clock day — which is the state
    // the whole rule exists to prevent.
    const start = new Date("2026-08-07T17:00:00Z");
    expect(isSingleAppDay(start, endOfStartDay(start))).toBe(true);
  });
});

describe("clampToStartDay", () => {
  it("leaves a span that already fits alone", () => {
    const start = new Date("2026-08-07T17:00:00Z");
    const end = new Date("2026-08-07T19:00:00Z");
    expect(clampToStartDay(start, end)).toBe(end);
  });

  it("pulls an overrunning end back to 23:59 of the start's day", () => {
    const start = new Date("2026-08-07T20:00:00Z"); // 22:00 Madrid
    const clamped = clampToStartDay(start, new Date("2026-08-08T02:00:00Z"));

    expect(formatAppDateParam(clamped)).toBe(formatAppDateParam(start));
    expect(formatAppTimeParam(clamped)).toBe("23:59");
    expect(isSingleAppDay(start, clamped)).toBe(true);
  });

  it("still leaves the event longer than nothing", () => {
    // Clamping must not invert the span — a resize that ended before its own
    // start would be worse than the multi-day state it replaced.
    const start = new Date("2026-08-07T20:00:00Z");
    const clamped = clampToStartDay(start, new Date("2026-08-08T05:00:00Z"));
    expect(clamped.getTime()).toBeGreaterThan(start.getTime());
  });
});

describe("SINGLE_DAY_MESSAGE", () => {
  it("says the rule in plain words, not schema-speak", () => {
    expect(SINGLE_DAY_MESSAGE).toMatch(/same day/);
    expect(SINGLE_DAY_MESSAGE).not.toMatch(/invalid|constraint/i);
  });
});
