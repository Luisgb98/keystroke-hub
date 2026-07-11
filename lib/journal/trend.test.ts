// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildAssessmentTrend,
  recentWeekStarts,
  TREND_WEEK_COUNT,
} from "./trend";

describe("recentWeekStarts", () => {
  it("returns TREND_WEEK_COUNT Mondays, oldest first, ending at throughWeekStart", () => {
    const weeks = recentWeekStarts("2026-07-06");

    expect(weeks).toHaveLength(TREND_WEEK_COUNT);
    expect(weeks[weeks.length - 1]).toBe("2026-07-06");
    expect(weeks[weeks.length - 2]).toBe("2026-06-29");
    expect(weeks[0]).toBe("2026-04-20");
  });

  it("has no duplicate or out-of-order weeks", () => {
    const weeks = recentWeekStarts("2026-01-05");
    const sorted = [...weeks].sort();
    expect(weeks).toEqual(sorted);
    expect(new Set(weeks).size).toBe(weeks.length);
  });
});

describe("buildAssessmentTrend", () => {
  it("fills every week with a gap when there are no reviews", () => {
    const trend = buildAssessmentTrend("2026-07-06", []);

    expect(trend).toHaveLength(TREND_WEEK_COUNT);
    expect(trend.every((week) => week.rating === null)).toBe(true);
    expect(trend.every((week) => week.changeNext === null)).toBe(true);
  });

  it("attaches a review's rating and changeNext to its matching week", () => {
    const trend = buildAssessmentTrend("2026-07-06", [
      {
        weekStart: "2026-07-06",
        rating: 4,
        changeNext: "Ship smaller PRs",
      },
    ]);

    const current = trend.find((week) => week.weekStart === "2026-07-06");
    expect(current).toEqual({
      weekStart: "2026-07-06",
      rating: 4,
      changeNext: "Ship smaller PRs",
    });
  });

  it("treats a week outside the fixed range as ignored, not injected as an extra row", () => {
    const trend = buildAssessmentTrend("2026-07-06", [
      { weekStart: "2020-01-06", rating: 5, changeNext: "Too old" },
    ]);

    expect(trend).toHaveLength(TREND_WEEK_COUNT);
    expect(trend.some((week) => week.weekStart === "2020-01-06")).toBe(false);
  });

  it("leaves unassessed neighbors as gaps alongside an assessed week", () => {
    const trend = buildAssessmentTrend("2026-07-06", [
      { weekStart: "2026-06-29", rating: 2, changeNext: null },
    ]);

    const assessed = trend.find((week) => week.weekStart === "2026-06-29");
    const gap = trend.find((week) => week.weekStart === "2026-07-06");

    expect(assessed?.rating).toBe(2);
    expect(gap?.rating).toBeNull();
  });
});
