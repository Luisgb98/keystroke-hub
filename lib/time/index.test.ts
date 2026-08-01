import { describe, expect, it } from "vitest";

import {
  APP_TIMEZONE,
  appAddDays,
  appEndOfDay,
  appIsSameDay,
  appMinutesSinceMidnight,
  appStartOfDay,
  appStartOfWeek,
  appTodayParam,
  appWallClock,
  formatAppDateParam,
  formatAppDateString,
  formatAppTimeParam,
  formatInAppZone,
  parseAppDate,
  parseAppDateTime,
} from "./index";

/**
 * The whole suite runs with `TZ=UTC` (vitest.config.ts) — what Vercel and CI
 * use — while `APP_TIMEZONE` is Europe/Madrid. Every assertion here is an
 * absolute `…Z` instant or an app-zone rendering; none re-parses the same
 * wall-clock string the code under test parses, which is the mistake that let
 * the +2h save shift ship (issue #95).
 *
 * Madrid reference offsets: CEST (+2) roughly Apr–Oct, CET (+1) otherwise.
 * In 2026 the changeovers are 2026-03-29 and 2026-10-25.
 */

describe("APP_TIMEZONE", () => {
  it("defaults to the owner's zone", () => {
    expect(APP_TIMEZONE).toBe("Europe/Madrid");
  });

  it("is not the process timezone the tests run in", () => {
    expect(process.env.TZ).toBe("UTC");
  });
});

describe("parseAppDateTime — the bug in issue #95", () => {
  it("stores a 19:00 summer time as 17:00Z, not 19:00Z", () => {
    // The old `new Date("2026-08-01T19:00:00")` produced 19:00Z on a UTC
    // server, which the calendar then rendered back as 21:00 in Madrid.
    expect(parseAppDateTime("2026-08-01", "19:00")!.toISOString()).toBe(
      "2026-08-01T17:00:00.000Z"
    );
  });

  it("stores a 19:00 winter time as 18:00Z", () => {
    expect(parseAppDateTime("2026-01-15", "19:00")!.toISOString()).toBe(
      "2026-01-15T18:00:00.000Z"
    );
  });

  it("round-trips every wall-clock time of the day unchanged", () => {
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of ["00", "30"]) {
        const time = `${String(hour).padStart(2, "0")}:${minute}`;
        const instant = parseAppDateTime("2026-08-01", time)!;
        expect(formatAppTimeParam(instant)).toBe(time);
        expect(formatAppDateParam(instant)).toBe("2026-08-01");
      }
    }
  });

  it("round-trips 19:00 on every day of the year, across both DST boundaries", () => {
    const mismatches: string[] = [];
    for (let i = 0; i < 365; i++) {
      const day = formatAppDateParam(
        new Date(Date.UTC(2026, 0, 1, 12) + i * 86_400_000)
      );
      const instant = parseAppDateTime(day, "19:00")!;
      const rendered = formatInAppZone(instant, "yyyy-MM-dd HH:mm");
      if (rendered !== `${day} 19:00`) mismatches.push(rendered);
    }
    expect(mismatches).toEqual([]);
  });

  it("puts an event saved under CET and one under CEST at the same wall clock", () => {
    const winter = parseAppDateTime("2026-01-15", "19:00")!;
    const summer = parseAppDateTime("2026-08-01", "19:00")!;
    expect(formatAppTimeParam(winter)).toBe("19:00");
    expect(formatAppTimeParam(summer)).toBe("19:00");
    // …while being different absolute offsets from UTC.
    expect(summer.getTime() % 86_400_000).not.toBe(
      winter.getTime() % 86_400_000
    );
  });

  it("resolves a wall clock that DST skips forward into the new offset", () => {
    // Madrid has no 02:30 on 2026-03-29 — the clock jumps 02:00 -> 03:00.
    const instant = parseAppDateTime("2026-03-29", "02:30")!;
    expect(instant.toISOString()).toBe("2026-03-29T01:30:00.000Z");
    expect(formatInAppZone(instant, "HH:mm")).toBe("03:30");
  });

  it("rejects malformed and nonexistent values", () => {
    expect(parseAppDateTime("2026-02-30", "19:00")).toBeNull();
    expect(parseAppDateTime("2026-08-01", "25:00")).toBeNull();
    expect(parseAppDateTime("2026-08-01", "19:99")).toBeNull();
    expect(parseAppDateTime("01/08/2026", "19:00")).toBeNull();
    expect(parseAppDateTime("", "19:00")).toBeNull();
  });
});

describe("parseAppDate", () => {
  it("resolves to app-zone midnight, not the server's", () => {
    expect(parseAppDate("2026-08-01")!.toISOString()).toBe(
      "2026-07-31T22:00:00.000Z"
    );
    expect(parseAppDate("2026-01-15")!.toISOString()).toBe(
      "2026-01-14T23:00:00.000Z"
    );
  });

  it("round-trips every day of 2026", () => {
    for (let i = 0; i < 365; i++) {
      const day = formatAppDateParam(
        new Date(Date.UTC(2026, 0, 1, 12) + i * 86_400_000)
      );
      expect(formatAppDateParam(parseAppDate(day)!)).toBe(day);
    }
  });

  it("rejects a well-formed but nonexistent day", () => {
    expect(parseAppDate("2026-02-30")).toBeNull();
    expect(parseAppDate("2026-13-01")).toBeNull();
    expect(parseAppDate("2025-02-29")).toBeNull();
    expect(parseAppDate("not-a-date")).toBeNull();
  });

  it("accepts a real leap day", () => {
    expect(formatAppDateParam(parseAppDate("2028-02-29")!)).toBe("2028-02-29");
  });
});

describe("day boundaries", () => {
  it("puts a 00:30 app-zone instant on its own day", () => {
    // 2026-07-31T22:30Z is 2026-08-01 00:30 in Madrid.
    const justAfterMidnight = new Date("2026-07-31T22:30:00Z");
    expect(formatAppDateParam(justAfterMidnight)).toBe("2026-08-01");
    expect(appStartOfDay(justAfterMidnight).toISOString()).toBe(
      "2026-07-31T22:00:00.000Z"
    );
    expect(appEndOfDay(justAfterMidnight).toISOString()).toBe(
      "2026-08-01T21:59:59.999Z"
    );
  });

  it("starts the week on Monday in the app zone", () => {
    // 2026-07-08 is a Wednesday.
    const weekStart = appStartOfWeek(parseAppDate("2026-07-08")!);
    expect(formatAppDateParam(weekStart)).toBe("2026-07-06");
    expect(formatInAppZone(weekStart, "EEEE HH:mm")).toBe("Monday 00:00");
  });

  it("adds calendar days, not 24h blocks, across a DST changeover", () => {
    // 2026-10-25 is 25 hours long in Madrid (CEST -> CET).
    const before = parseAppDateTime("2026-10-24", "12:00")!;
    const after = appAddDays(before, 1);
    expect(formatInAppZone(after, "yyyy-MM-dd HH:mm")).toBe("2026-10-25 12:00");
    expect(after.getTime() - before.getTime()).toBe(25 * 60 * 60 * 1000);
  });

  it("compares days in the app zone", () => {
    const lateEvening = new Date("2026-07-31T22:30:00Z"); // Aug 1, 00:30 Madrid
    const nextMorning = new Date("2026-08-01T07:00:00Z"); // Aug 1, 09:00 Madrid
    expect(appIsSameDay(lateEvening, nextMorning)).toBe(true);
    // The same pair are *different* days in UTC — which is the old behavior.
    expect(lateEvening.getUTCDate()).not.toBe(nextMorning.getUTCDate());
  });
});

describe("wall-clock readers", () => {
  it("reads hours and minutes in the app zone", () => {
    const wall = appWallClock(new Date("2026-08-01T17:00:00Z"));
    expect(wall.getHours()).toBe(19);
    expect(wall.getDate()).toBe(1);
  });

  it("measures minutes since app-zone midnight", () => {
    expect(
      appMinutesSinceMidnight(parseAppDateTime("2026-08-01", "00:00")!)
    ).toBe(0);
    expect(
      appMinutesSinceMidnight(parseAppDateTime("2026-08-01", "01:30")!)
    ).toBe(90);
    expect(
      appMinutesSinceMidnight(parseAppDateTime("2026-08-01", "23:59")!)
    ).toBe(23 * 60 + 59);
  });
});

describe("formatting helpers", () => {
  it("renders an instant in the app zone regardless of the process zone", () => {
    expect(
      formatInAppZone(new Date("2026-08-01T17:00:00Z"), "yyyy-MM-dd HH:mm")
    ).toBe("2026-08-01 19:00");
  });

  it("formats a bare date string without a zone round trip", () => {
    expect(formatAppDateString("2026-08-01", "MMM d, yyyy")).toBe(
      "Aug 1, 2026"
    );
  });

  it("passes an unparseable date string through rather than throwing", () => {
    expect(formatAppDateString("2026-02-30", "MMM d")).toBe("2026-02-30");
  });

  it("resolves today in the app zone", () => {
    const now = new Date();
    expect(appTodayParam(now)).toBe(formatAppDateParam(now));
    // Between 22:00Z and midnight UTC in summer, the app zone is already on
    // the next day — the divergence the journal used to have (#95).
    expect(appTodayParam(new Date("2026-07-31T22:30:00Z"))).toBe("2026-08-01");
  });
});
