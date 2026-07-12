import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Lightbulb } from "lucide-react";

import { buildContentSnapshot } from "@/lib/dashboard/content-snapshot";
import { getIdeasInFlight } from "@/lib/data/ideas";
import type { Idea } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Self-fetching content-in-flight snapshot for the dashboard (issue
 * #28/#16) — per-stage counts of the idea pipeline plus the most-stuck
 * item, the same signal the board sorts by. Same DB-failure resilience
 * contract as `UpcomingAgenda`: a query failure renders the empty state
 * rather than breaking the host page (CI's e2e job has no DATABASE_URL,
 * see docs/database.md).
 */
export async function ContentSnapshotCard() {
  let ideasInFlight: Idea[] = [];
  try {
    ideasInFlight = await getIdeasInFlight();
  } catch (error) {
    console.error("Failed to load the content pipeline:", error);
  }

  const snapshot = buildContentSnapshot(ideasInFlight);

  return (
    <Card className="border-track-content-border">
      <CardHeader>
        <CardTitle>Content in flight</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {snapshot.total === 0 ? (
          <p className="text-small text-muted-foreground">
            Nothing in the pipeline. Capture an idea to get started.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {snapshot.counts
                .filter((stage) => stage.count > 0)
                .map((stage) => (
                  <Badge key={stage.status} variant="outline">
                    {stage.label} · {stage.count}
                  </Badge>
                ))}
            </div>
            {snapshot.stuckIdea ? (
              <p className="flex items-center gap-1.5 text-small text-muted-foreground">
                <Lightbulb aria-hidden className="size-3.5 shrink-0" />
                <span className="line-clamp-1">
                  Stuck longest: {snapshot.stuckIdea.title}
                </span>
                <span
                  className="shrink-0 font-mono text-caption"
                  title={snapshot.stuckIdea.stageEnteredAt.toLocaleString()}
                >
                  {formatDistanceToNow(snapshot.stuckIdea.stageEnteredAt, {
                    addSuffix: true,
                  })}
                </span>
              </p>
            ) : null}
          </>
        )}
      </CardContent>
      <CardFooter>
        <Link
          href="/content/board"
          className="text-small font-medium text-primary hover:underline"
        >
          Open board →
        </Link>
      </CardFooter>
    </Card>
  );
}
