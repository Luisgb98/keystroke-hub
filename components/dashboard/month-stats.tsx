import { Clapperboard, Lightbulb, Radio } from "lucide-react";

import { getMonthOutput, type MonthOutput } from "@/lib/data/dashboard";
import {
  buildDelta,
  formatDeltaLabel,
  monthRange,
  shiftMonthParam,
} from "@/lib/dashboard/month-review";
import { Skeleton } from "@/components/ui/skeleton";

import { StatTile } from "./stat-tile";

interface MonthStatsViewProps {
  /** `null` means the query failed — an empty month is a real result of honest zeros, not an error. */
  output: MonthOutput | null;
  /** `null` when only the comparison failed: the headline numbers still render, without deltas. */
  previous: MonthOutput | null;
  previousMonth: string;
}

const TILE_CLASS = "grid gap-3 sm:grid-cols-3";

/**
 * The month's headline row: what went out (videos, streams) and what came
 * in (ideas), each against the previous month. Pure, so its three states —
 * data, empty month, failed query — are unit-testable.
 */
export function MonthStatsView({
  output,
  previous,
  previousMonth,
}: MonthStatsViewProps) {
  if (!output) {
    return (
      <p className="text-small text-muted-foreground">
        Couldn&rsquo;t load this month&rsquo;s numbers.
      </p>
    );
  }

  function deltaFor(pick: (value: MonthOutput) => number) {
    if (!previous || !output) return {};
    const delta = buildDelta(pick(output), pick(previous));
    return {
      delta: formatDeltaLabel(delta, previousMonth),
      direction: delta.direction,
    };
  }

  return (
    <div className={TILE_CLASS}>
      <StatTile
        label="Videos published"
        value={output.publishedVideos}
        icon={Clapperboard}
        href="/content/ideas?status=published"
        {...deltaFor((value) => value.publishedVideos)}
      />
      <StatTile
        label="Streams"
        value={output.streamsHeld}
        icon={Radio}
        href="/content/streams"
        {...deltaFor((value) => value.streamsHeld)}
      />
      <StatTile
        label="Ideas captured"
        value={output.ideasCreated}
        icon={Lightbulb}
        href="/content/ideas"
        {...deltaFor((value) => value.ideasCreated)}
      />
    </div>
  );
}

export function MonthStatsSkeleton() {
  return (
    <div className={TILE_CLASS}>
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Self-fetching headline block for the month review (issue #110). Same
 * DB-failure resilience contract as the Today blocks: a query failure
 * renders this block's own message rather than breaking the page (CI's e2e
 * job has no DATABASE_URL, see docs/database.md).
 *
 * The two months are read with one shared `now`, so the "in the past"
 * boundary that decides whether a stream happened can't drift between the
 * current-month and previous-month queries.
 */
export async function MonthStats({ month }: { month: string }) {
  const previousMonth = shiftMonthParam(month, -1);
  const now = new Date();
  // `allSettled`, not `all`: the comparison month failing is not a reason to
  // withhold this month's numbers — the tiles just lose their delta lines.
  const [current, comparison] = await Promise.allSettled([
    getMonthOutput(monthRange(month), now),
    getMonthOutput(monthRange(previousMonth), now),
  ]);

  if (current.status === "rejected") {
    console.error("Failed to load the month's output:", current.reason);
  }
  if (comparison.status === "rejected") {
    console.error(
      "Failed to load the previous month's output:",
      comparison.reason
    );
  }

  const output = current.status === "fulfilled" ? current.value : null;
  const previous = comparison.status === "fulfilled" ? comparison.value : null;

  return (
    <MonthStatsView
      output={output}
      previous={previous}
      previousMonth={previousMonth}
    />
  );
}
