import Link from "next/link";
import { CheckCircle2, ClipboardList } from "lucide-react";

import { formatDayLabel } from "@/lib/journal/dates";
import type { StandupView as StandupViewData } from "@/lib/journal/standup";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface StandupViewProps {
  view: StandupViewData;
}

/** Two stacked cards: "yesterday's" done items + today's plan (see docs/journal.md). */
export function StandupView({ view }: StandupViewProps) {
  return (
    <div data-slot="standup-view" className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <CheckCircle2
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
          <h2 className="text-small font-semibold">
            {view.yesterday
              ? `${formatDayLabel(view.yesterday.date)} — done`
              : "No previous log yet"}
          </h2>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!view.yesterday || view.yesterday.isEmpty ? (
            <p className="text-small text-muted-foreground">
              Nothing logged as done.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {view.yesterday.items.map((item) => (
                <li key={item.id} className="text-small">
                  {item.title}
                </li>
              ))}
            </ul>
          )}
          {view.yesterday ? (
            <Link
              href={`/journal?date=${view.yesterday.date}`}
              className="self-start text-caption text-muted-foreground hover:underline"
            >
              Open that day
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <ClipboardList
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
          <h2 className="text-small font-semibold">
            {formatDayLabel(view.today.date)} — plan
          </h2>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {view.today.isEmpty ? (
            <>
              <p className="text-small text-muted-foreground">
                No plan yet — add one.
              </p>
              <Link
                href={`/journal?date=${view.today.date}`}
                className="self-start text-small text-primary hover:underline"
              >
                Go to today&apos;s log
              </Link>
            </>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {view.today.items.map((item) => (
                <li
                  key={item.id}
                  className={
                    item.status === "done"
                      ? "text-small text-muted-foreground line-through"
                      : "text-small"
                  }
                >
                  {item.title}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
