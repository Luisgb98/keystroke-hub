import Link from "next/link";
import { CircleCheck, ClipboardList, ListTodo } from "lucide-react";

import { buildLogSummary } from "@/lib/dashboard/log-summary";
import { getDayLog } from "@/lib/data/daily-logs";
import { todayParam } from "@/lib/journal/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Self-fetching today's-log status block for the dashboard (issue #28/#21)
 * — the daily ritual gets the prime slot. Server-rendered per request, same
 * DB-failure resilience contract as `UpcomingAgenda`: a query failure
 * renders the "not started" empty state rather than breaking the host page
 * (CI's e2e job has no DATABASE_URL, see docs/database.md).
 */
export async function LogStatusCard() {
  let summary = buildLogSummary({ log: null, items: [] });
  try {
    const dayLog = await getDayLog(todayParam());
    summary = buildLogSummary(dayLog);
  } catch (error) {
    console.error("Failed to load today's log:", error);
  }

  return (
    <Card className="border-track-work-border">
      <CardHeader>
        <CardTitle>Today&rsquo;s log</CardTitle>
      </CardHeader>
      <CardContent>
        {summary.state === "not_started" ? (
          <p className="text-small text-muted-foreground">
            Nothing logged yet today.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="gap-1">
              <ListTodo aria-hidden className="size-3" />
              {summary.plannedCount} planned
            </Badge>
            <Badge variant="outline" className="gap-1">
              <CircleCheck aria-hidden className="size-3" />
              {summary.doneCount} done
            </Badge>
            {summary.moodLabel ? (
              <Badge variant="outline">{summary.moodLabel}</Badge>
            ) : null}
            {summary.hasRetro ? (
              <Badge variant="outline">Retro written</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Retro pending
              </Badge>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        <Button nativeButton={false} render={<Link href={summary.ctaHref} />}>
          {summary.ctaLabel}
        </Button>
        <Link
          href="/journal/standup"
          className="flex items-center gap-1 text-small font-medium text-primary hover:underline"
        >
          <ClipboardList aria-hidden className="size-3.5" />
          Standup
        </Link>
      </CardFooter>
    </Card>
  );
}
