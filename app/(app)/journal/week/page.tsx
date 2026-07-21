import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, TrendingUp } from "lucide-react";

import { CopySummaryButton } from "@/components/journal/copy-summary-button";
import { HighlightsCard } from "@/components/journal/highlights-card";
import { WeeklyAssessmentCard } from "@/components/journal/weekly-assessment-card";
import { WeeklySignals } from "@/components/journal/weekly-signals";
import { WeekHeader } from "@/components/journal/week-header";
import { WeekSummaryView } from "@/components/journal/week-summary";
import { Button } from "@/components/ui/button";
import { getWeekSummary } from "@/lib/data/weekly-reviews";
import { WEEKDAY_COUNT } from "@/lib/journal/signals";
import { parseWeekParam } from "@/lib/journal/week-dates";
import type { WeekSummary } from "@/lib/journal/week-summary";

export const metadata: Metadata = {
  title: "Week in review",
};

interface WeekSummaryPageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function WeekSummaryPage({
  searchParams,
}: WeekSummaryPageProps) {
  const params = await searchParams;
  const weekStart = parseWeekParam(params.week);

  // Same DB-unreachable resilience contract as the other journal routes —
  // e.g. CI's e2e job has no DATABASE_URL (see docs/database.md) but still
  // exercises this page via shell-navigation.spec.ts.
  let summary: WeekSummary = {
    weekStart,
    doneByDay: [],
    retros: [],
    carriedOver: [],
    highlights: "",
    isEmpty: true,
    rating: null,
    wentWell: "",
    drainedMe: "",
    changeNext: "",
    signals: {
      weekdaysLogged: 0,
      weekdayCount: WEEKDAY_COUNT,
      doneCount: 0,
      trackedCount: 0,
      carriedOverCount: 0,
    },
  };
  try {
    summary = await getWeekSummary(weekStart);
  } catch (error) {
    console.error("Failed to load the week summary:", error);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:mx-auto sm:w-full sm:max-w-2xl sm:px-10 sm:py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-h1 font-semibold">Week in review</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/journal/week/trend" />}
          >
            <TrendingUp aria-hidden />
            Trend
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/journal" />}
          >
            <ArrowLeft aria-hidden />
            Journal
          </Button>
        </div>
      </div>

      {/* Keyed by weekStart: each subcomponent owns its own local state,
          which must reset on week navigation rather than carry over from
          the previously-viewed week. */}
      <WeekHeader key={`week-header-${weekStart}`} weekStart={weekStart} />

      <div className="flex items-center justify-end">
        <CopySummaryButton summary={summary} />
      </div>

      <HighlightsCard
        key={`highlights-${weekStart}`}
        weekStart={weekStart}
        highlights={summary.highlights}
      />

      <WeekSummaryView summary={summary} />

      <WeeklyAssessmentCard
        key={`assessment-${weekStart}`}
        weekStart={weekStart}
        rating={summary.rating}
        wentWell={summary.wentWell}
        drainedMe={summary.drainedMe}
        changeNext={summary.changeNext}
      />

      <WeeklySignals signals={summary.signals} />
    </div>
  );
}
