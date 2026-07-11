import Link from "next/link";

import { formatDayLabel, formatShortDayLabel } from "@/lib/journal/dates";
import { moodLabel } from "@/lib/journal/mood";
import type { WeekSummary as WeekSummaryData } from "@/lib/journal/week-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Mon–Fri always render; Sat/Sun only when they have data (see docs/journal.md). */
const WEEKDAY_COUNT = 5;

interface WeekSummaryProps {
  summary: WeekSummaryData;
}

function dayHasData(
  day: WeekSummaryData["doneByDay"][number],
  summary: WeekSummaryData
): boolean {
  return (
    day.done.length > 0 ||
    summary.retros.some((retro) => retro.date === day.date)
  );
}

/** Grouped read view, ordered for reading aloud: done-by-day, then retros, then carried-over (see docs/journal.md). */
export function WeekSummaryView({ summary }: WeekSummaryProps) {
  if (summary.isEmpty) {
    return (
      <p className="text-small text-muted-foreground">
        Nothing logged this week yet.{" "}
        <Link href="/journal" className="text-primary hover:underline">
          Go to today&apos;s log
        </Link>
        .
      </p>
    );
  }

  const visibleDays = summary.doneByDay.filter(
    (day, index) => index < WEEKDAY_COUNT || dayHasData(day, summary)
  );

  return (
    <div data-slot="week-summary" className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-small font-semibold">Done by day</h2>
        {visibleDays.map((day) => (
          <div key={day.date} className="flex flex-col gap-1">
            <Link
              href={`/journal?date=${day.date}`}
              className="text-caption font-medium text-muted-foreground hover:underline"
            >
              {formatDayLabel(day.date)}
            </Link>
            {day.done.length === 0 ? (
              <p className="text-small text-muted-foreground">
                Nothing logged.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {day.done.map((item) => (
                  <li key={item.id} className="text-small">
                    {item.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      {summary.retros.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-small font-semibold">Retros</h2>
          <div className="flex flex-col gap-3">
            {summary.retros.map((retro) => (
              <Card key={retro.date} size="sm">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle>{formatDayLabel(retro.date)}</CardTitle>
                  {moodLabel(retro.mood) ? (
                    <span className="text-caption text-muted-foreground">
                      {moodLabel(retro.mood)}
                    </span>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <p className="text-small">{retro.retro}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {summary.carriedOver.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-small font-semibold">Carried over</h2>
          <ul className="flex flex-col gap-1.5">
            {summary.carriedOver.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-small"
              >
                <span>{item.title}</span>
                <span className="text-caption text-muted-foreground">
                  since {formatShortDayLabel(item.firstAppearedDate)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
