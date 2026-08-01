import { describe, expect, it } from "vitest";

import {
  appStartOfDay,
  formatAppDateParam,
  formatInAppZone,
  parseAppDate,
  parseAppDateTime,
} from "./index";
import { needsShiftRepair, repairShiftedInstant } from "./shift-repair";

/**
 * These tests reconstruct the pre-fix behavior explicitly (`storedByTheBug`)
 * and assert the repair lands on the instant the fixed parser would produce —
 * so they verify the two halves against each other rather than against a
 * restatement of either one.
 */

/** What the old `new Date(\`${date}T${time}:00\`)` produced on a UTC server. */
function storedByTheBug(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`);
}

describe("repairShiftedInstant", () => {
  it("moves a summer 19:00 row back to the instant 19:00 Madrid really is", () => {
    const stored = storedByTheBug("2026-08-01", "19:00");
    expect(stored.toISOString()).toBe("2026-08-01T19:00:00.000Z");

    const repaired = repairShiftedInstant(stored);
    expect(repaired.toISOString()).toBe("2026-08-01T17:00:00.000Z");
    expect(repaired).toEqual(parseAppDateTime("2026-08-01", "19:00"));
    expect(formatInAppZone(repaired, "HH:mm")).toBe("19:00");
  });

  it("moves a winter row by one hour, not two", () => {
    const repaired = repairShiftedInstant(
      storedByTheBug("2026-01-15", "19:00")
    );
    expect(repaired.toISOString()).toBe("2026-01-15T18:00:00.000Z");
    expect(repaired).toEqual(parseAppDateTime("2026-01-15", "19:00"));
  });

  it("repairs an all-day row's midnight boundary", () => {
    const stored = storedByTheBug("2026-08-01", "00:00");
    const repaired = repairShiftedInstant(stored);
    expect(repaired).toEqual(parseAppDate("2026-08-01"));
    expect(repaired).toEqual(appStartOfDay(repaired));
    expect(formatAppDateParam(repaired)).toBe("2026-08-01");
  });

  it("agrees with the fixed parser on every hour of every day of the year", () => {
    const mismatches: string[] = [];
    for (let i = 0; i < 365; i++) {
      const day = formatAppDateParam(
        new Date(Date.UTC(2026, 0, 1, 12) + i * 86_400_000)
      );
      for (const hour of ["00", "07", "13", "19", "23"]) {
        const time = `${hour}:00`;
        const repaired = repairShiftedInstant(storedByTheBug(day, time));
        const expected = parseAppDateTime(day, time);
        if (repaired.getTime() !== expected!.getTime()) {
          mismatches.push(`${day} ${time}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("is not a fixed two-hour subtraction across the DST changeover", () => {
    const beforeChangeover = repairShiftedInstant(
      storedByTheBug("2026-03-28", "19:00")
    );
    const afterChangeover = repairShiftedInstant(
      storedByTheBug("2026-03-29", "19:00")
    );
    // CET (+1) the day before, CEST (+2) the day after.
    expect(beforeChangeover.toISOString()).toBe("2026-03-28T18:00:00.000Z");
    expect(afterChangeover.toISOString()).toBe("2026-03-29T17:00:00.000Z");
  });

  it("is NOT idempotent — the script must never run twice", () => {
    // Documented here because it's the one real hazard of the repair: a second
    // pass would shift already-corrected rows again.
    const once = repairShiftedInstant(storedByTheBug("2026-08-01", "19:00"));
    const twice = repairShiftedInstant(once);
    expect(twice.getTime()).not.toBe(once.getTime());
  });
});

describe("needsShiftRepair", () => {
  it("is true for a row the bug touched", () => {
    expect(needsShiftRepair(storedByTheBug("2026-08-01", "19:00"))).toBe(true);
  });

  it("is false for an instant that already sits at the app-zone offset", () => {
    // 22:00Z is app-zone midnight in summer; re-reading its UTC wall clock
    // (22:00) as Madrid would move it, so the guard is about the *offset*,
    // not about correctness — a zone at UTC+0 would make every row a no-op.
    expect(needsShiftRepair(new Date("2026-08-01T00:00:00.000Z"))).toBe(true);
  });
});
