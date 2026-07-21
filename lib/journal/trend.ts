import type { WeeklyReview } from "@/lib/db/schema";

import { shiftWeekParam } from "./week-dates";

export const TREND_WEEK_COUNT = 12;

export interface TrendWeek {
  weekStart: string;
  rating: number | null;
  changeNext: string | null;
}

/** The last `TREND_WEEK_COUNT` Mondays through and including `throughWeekStart`, oldest first. */
export function recentWeekStarts(throughWeekStart: string): string[] {
  const weeks: string[] = [];
  let current = throughWeekStart;
  for (let i = 0; i < TREND_WEEK_COUNT; i++) {
    weeks.unshift(current);
    current = shiftWeekParam(current, -1);
  }
  return weeks;
}

/**
 * Pure composition: a fixed week-start range plus whatever reviews exist for
 * it. Unassessed weeks become explicit gaps rather than being omitted — the
 * trend view renders them as quiet gaps, not failures (see docs/journal.md).
 */
export function buildAssessmentTrend(
  throughWeekStart: string,
  reviews: Pick<WeeklyReview, "weekStart" | "rating" | "changeNext">[]
): TrendWeek[] {
  const reviewsByWeek = new Map(
    reviews.map((review) => [review.weekStart, review])
  );

  return recentWeekStarts(throughWeekStart).map((weekStart) => {
    const review = reviewsByWeek.get(weekStart);
    return {
      weekStart,
      rating: review?.rating ?? null,
      changeNext: review?.changeNext ?? null,
    };
  });
}
