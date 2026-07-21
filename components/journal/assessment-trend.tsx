import Link from "next/link";

import type { TrendWeek } from "@/lib/journal/trend";
import { formatWeekLabel } from "@/lib/journal/week-dates";
import { cn } from "@/lib/utils";

const RATING_DOTS = [1, 2, 3, 4, 5] as const;

interface AssessmentTrendProps {
  weeks: TrendWeek[];
}

/**
 * One row per week, oldest first: week label, rating as a filled position on
 * a quiet 5-dot strip (single neutral accent — no red-to-green ramp), and
 * the week's "change next week" note, since that's the actionable thread
 * between weeks. Unassessed weeks render as muted gaps, not failures. Each
 * row links back to that week's summary (see docs/journal.md).
 */
export function AssessmentTrend({ weeks }: AssessmentTrendProps) {
  const hasAnyData = weeks.some(
    (week) => week.rating !== null || week.changeNext
  );

  if (!hasAnyData) {
    return (
      <p className="text-small text-muted-foreground">No weeks assessed yet.</p>
    );
  }

  return (
    <ul data-slot="assessment-trend" className="flex flex-col gap-2">
      {weeks.map((week) => (
        <li key={week.weekStart}>
          <Link
            href={`/journal/week?week=${week.weekStart}`}
            className="flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-caption text-muted-foreground">
                {formatWeekLabel(week.weekStart)}
              </span>
              <div
                className="flex items-center gap-1"
                aria-label={
                  week.rating !== null
                    ? `Rating ${week.rating} of 5`
                    : "Not assessed"
                }
              >
                {RATING_DOTS.map((dot) => (
                  <span
                    key={dot}
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      week.rating !== null && dot <= week.rating
                        ? "bg-primary"
                        : "bg-border"
                    )}
                  />
                ))}
              </div>
            </div>
            {week.changeNext ? (
              <p className="text-small">{week.changeNext}</p>
            ) : week.rating === null ? (
              <p className="text-small text-muted-foreground">Not assessed</p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
