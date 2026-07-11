import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AssessmentTrend } from "@/components/journal/assessment-trend";
import { Button } from "@/components/ui/button";
import { getRecentWeeklyReviews } from "@/lib/data/weekly-reviews";
import {
  buildAssessmentTrend,
  TREND_WEEK_COUNT,
  type TrendWeek,
} from "@/lib/journal/trend";
import { currentWeekParam } from "@/lib/journal/week-dates";

export const metadata: Metadata = {
  title: "Assessment trend",
};

export default async function AssessmentTrendPage() {
  const throughWeekStart = currentWeekParam();

  // Same DB-unreachable resilience contract as the other journal routes —
  // e.g. CI's e2e job has no DATABASE_URL (see docs/database.md) but still
  // exercises this page via shell-navigation.spec.ts.
  let weeks: TrendWeek[] = buildAssessmentTrend(throughWeekStart, []);
  try {
    const reviews = await getRecentWeeklyReviews(
      throughWeekStart,
      TREND_WEEK_COUNT
    );
    weeks = buildAssessmentTrend(throughWeekStart, reviews);
  } catch (error) {
    console.error("Failed to load the assessment trend:", error);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:mx-auto sm:w-full sm:max-w-2xl sm:px-10 sm:py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-h1 font-semibold">Assessment trend</h1>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/journal/week" />}
        >
          <ArrowLeft aria-hidden />
          Week
        </Button>
      </div>

      <AssessmentTrend weeks={weeks} />
    </div>
  );
}
