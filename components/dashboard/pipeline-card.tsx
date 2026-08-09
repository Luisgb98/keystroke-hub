import Link from "next/link";
import { Columns3 } from "lucide-react";

import {
  getPipelineSnapshot,
  type PipelineSnapshot,
} from "@/lib/data/dashboard";
import { monthRange, withShare } from "@/lib/dashboard/month-review";
import { IDEA_STATUS_LABEL } from "@/lib/content/idea-status";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { MonthCardSkeleton } from "./month-card-skeleton";
import { RankingBars } from "./ranking-bars";

interface PipelineViewProps {
  /** `null` means the query failed — a pipeline of honest zeros is a real result. */
  snapshot: PipelineSnapshot | null;
}

/**
 * The shape of the idea pipeline right now, plus how much of it moved into
 * a late stage during the selected month — which is what makes "a month of
 * heavy scripting but nothing published" visible as exactly that.
 *
 * Stages stay in pipeline order rather than being ranked by size: the
 * reader is looking for where work is piling up, and a re-ordered pipeline
 * would hide that. Pure, so data/empty/error are unit-testable.
 */
export function PipelineView({ snapshot }: PipelineViewProps) {
  if (!snapshot) {
    return (
      <p className="text-small text-muted-foreground">
        Couldn&rsquo;t load the pipeline.
      </p>
    );
  }

  if (snapshot.total === 0) {
    return (
      <p className="text-small text-muted-foreground">
        Nothing in the pipeline. Capture an idea to get started.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <RankingBars
        unit="ideas"
        rows={withShare(
          snapshot.stages.map((stage) => ({
            key: stage.status,
            label: IDEA_STATUS_LABEL[stage.status],
            count: stage.count,
            // An empty stage has nothing to open, so it isn't a link.
            href:
              stage.count > 0 ? `/content/ideas?status=${stage.status}` : null,
          }))
        )}
      />
      <p className="text-small text-muted-foreground">
        {snapshot.lateStageMoves === 0
          ? "Nothing reached recording or beyond this month."
          : `${snapshot.lateStageMoves} ${
              snapshot.lateStageMoves === 1 ? "idea" : "ideas"
            } reached recording or beyond this month.`}
      </p>
    </div>
  );
}

/** Self-fetching pipeline block — same per-block DB-failure contract as the Today blocks (docs/database.md). */
export async function PipelineCard({ month }: { month: string }) {
  let snapshot: PipelineSnapshot | null = null;
  try {
    snapshot = await getPipelineSnapshot(monthRange(month));
  } catch (error) {
    console.error("Failed to load the pipeline snapshot:", error);
  }

  return (
    <Card className="border-track-content-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Columns3 aria-hidden className="size-4 shrink-0" />
          Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <PipelineView snapshot={snapshot} />
      </CardContent>
      <CardFooter className="mt-auto">
        {/* Not "Open board →": that is the Today block's footer, and the two
            cards share the page — one label per destination per screen. */}
        <Link
          href="/content/board"
          className="text-small font-medium text-primary hover:underline"
        >
          Board →
        </Link>
      </CardFooter>
    </Card>
  );
}

export function PipelineSkeleton() {
  return <MonthCardSkeleton title="Pipeline" />;
}
