import { describe, expect, it } from "vitest";

import {
  quickAddFromDayCell,
  quickAddFromNow,
  quickAddFromSlot,
} from "./quick-add";

describe("quickAddFromSlot", () => {
  it("defaults to a 1h timed event starting on the tapped hour", () => {
    const day = new Date("2026-07-08T00:00:00");
    expect(quickAddFromSlot(day, 9)).toEqual({
      allDay: false,
      startDate: "2026-07-08",
      startTime: "09:00",
      endDate: "2026-07-08",
      endTime: "10:00",
    });
  });

  it("rolls the end date into the next day when the slot is the last hour", () => {
    const day = new Date("2026-07-08T00:00:00");
    expect(quickAddFromSlot(day, 23)).toEqual({
      allDay: false,
      startDate: "2026-07-08",
      startTime: "23:00",
      endDate: "2026-07-09",
      endTime: "00:00",
    });
  });
});

describe("quickAddFromDayCell", () => {
  it("defaults to an all-day event on the given date", () => {
    const day = new Date("2026-07-08T00:00:00");
    expect(quickAddFromDayCell(day)).toEqual({
      allDay: true,
      startDate: "2026-07-08",
      endDate: "2026-07-08",
    });
  });
});

describe("quickAddFromNow", () => {
  it("rounds up to the next 30-minute mark and defaults a 1h duration", () => {
    const now = new Date("2026-07-08T09:10:00");
    expect(quickAddFromNow(now)).toEqual({
      allDay: false,
      startDate: "2026-07-08",
      startTime: "09:30",
      endDate: "2026-07-08",
      endTime: "10:30",
    });
  });

  it("stays put when already on a 30-minute mark", () => {
    const now = new Date("2026-07-08T09:30:00");
    expect(quickAddFromNow(now)).toEqual({
      allDay: false,
      startDate: "2026-07-08",
      startTime: "09:30",
      endDate: "2026-07-08",
      endTime: "10:30",
    });
  });

  it("rolls over midnight when rounding up near end of day", () => {
    const now = new Date("2026-07-08T23:45:00");
    expect(quickAddFromNow(now)).toEqual({
      allDay: false,
      startDate: "2026-07-09",
      startTime: "00:00",
      endDate: "2026-07-09",
      endTime: "01:00",
    });
  });
});
