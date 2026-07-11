import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CopySummaryButton } from "@/components/journal/copy-summary-button";
import { HighlightsCard } from "@/components/journal/highlights-card";
import { WeekHeader } from "@/components/journal/week-header";
import { WeekSummaryView } from "@/components/journal/week-summary";
import { Button } from "@/components/ui/button";
import { getWeekSummary } from "@/lib/data/weekly-reviews";
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
    </div>
  );
}
