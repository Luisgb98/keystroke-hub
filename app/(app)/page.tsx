import { Suspense } from "react";
import type { Metadata } from "next";

import { UpcomingAgenda } from "@/components/agenda/upcoming-agenda";
import { ContentSnapshotCard } from "@/components/dashboard/content-snapshot-card";
import {
  GameRankingCard,
  GameRankingSkeleton,
} from "@/components/dashboard/game-ranking-card";
import { LogStatusCard } from "@/components/dashboard/log-status-card";
import { MonthPicker } from "@/components/dashboard/month-picker";
import {
  MonthStats,
  MonthStatsSkeleton,
} from "@/components/dashboard/month-stats";
import {
  PipelineCard,
  PipelineSkeleton,
} from "@/components/dashboard/pipeline-card";
import {
  TagRankingCard,
  TagRankingSkeleton,
} from "@/components/dashboard/tag-ranking-card";
import { parseMonthParam } from "@/lib/dashboard/month-review";
import { formatDayLabel, todayParam } from "@/lib/journal/dates";

export const metadata: Metadata = {
  title: "Dashboard",
};

interface DashboardPageProps {
  searchParams: Promise<{ month?: string | string[] }>;
}

/**
 * The home screen: today first (issue #28), then how the month went
 * (issue #110).
 *
 * Both halves are thin composition over self-fetching blocks, each
 * following `UpcomingAgenda`'s resilience contract (a DB failure renders
 * that block's own empty state rather than breaking the page). The Today
 * blocks render inline — they're the reason the page exists and must not
 * arrive late — while every month-review block streams inside its own
 * `<Suspense>`, so five extra aggregation queries can't delay the fold.
 *
 * The boundaries are keyed by month: stepping the picker swaps in
 * skeletons for the review section while the Today blocks stay put.
 */
export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  // Missing, malformed and future values all land on the current month.
  const month = parseMonthParam(params.month);

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 py-6 sm:px-10 sm:py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-h1 font-semibold">Dashboard</h1>
          <p className="font-mono text-small text-muted-foreground">
            {formatDayLabel(todayParam())}
          </p>
        </div>
        <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start">
          <UpcomingAgenda maxItems={5} />
          <div className="flex flex-col gap-6">
            <LogStatusCard />
            <ContentSnapshotCard />
          </div>
        </div>
      </div>

      <section aria-labelledby="month-review" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-col gap-1">
            <h2
              id="month-review"
              className="font-heading text-h2 font-semibold"
            >
              The month
            </h2>
            <p className="text-small text-muted-foreground">
              What shipped, what got played, what got said.
            </p>
          </div>
          <MonthPicker month={month} />
        </div>

        {/* Headline numbers first: on a phone they are the part of the
            review worth reaching, and the rankings elaborate on them. */}
        <Suspense key={`stats-${month}`} fallback={<MonthStatsSkeleton />}>
          <MonthStats month={month} />
        </Suspense>

        <div data-slot="month-rankings" className="grid gap-4 md:grid-cols-3">
          <Suspense key={`games-${month}`} fallback={<GameRankingSkeleton />}>
            <GameRankingCard month={month} />
          </Suspense>
          <Suspense key={`tags-${month}`} fallback={<TagRankingSkeleton />}>
            <TagRankingCard month={month} />
          </Suspense>
          <Suspense key={`pipeline-${month}`} fallback={<PipelineSkeleton />}>
            <PipelineCard month={month} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
