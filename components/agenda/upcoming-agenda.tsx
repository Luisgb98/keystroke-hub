import { addDays, endOfDay, startOfDay } from "date-fns";
import { CalendarClock } from "lucide-react";
import Link from "next/link";

import { AGENDA_HORIZON_DAYS, buildAgenda } from "@/lib/calendar/agenda";
import type { CalendarEvent } from "@/lib/calendar/types";
import { getUpcomingEvents } from "@/lib/data/events";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { AgendaItemRow } from "./agenda-item";

interface UpcomingAgendaProps {
  className?: string;
  maxItems?: number;
}

/**
 * Self-fetching "what's next" widget spanning today + tomorrow across both
 * tracks — a drop-in for any host page (issue #14). Server-rendered per
 * request like the calendar page, with the same DB-failure resilience
 * contract: a query failure renders the empty state rather than breaking
 * the host page (CI's e2e job has no `DATABASE_URL`, see docs/database.md).
 */
export async function UpcomingAgenda({
  className,
  maxItems,
}: UpcomingAgendaProps) {
  const now = new Date();
  const horizonEnd = endOfDay(
    addDays(startOfDay(now), AGENDA_HORIZON_DAYS - 1)
  );

  let events: CalendarEvent[] = [];
  try {
    events = await getUpcomingEvents(now, horizonEnd);
  } catch (error) {
    console.error("Failed to load upcoming events:", error);
  }

  const days = buildAgenda(events, now, maxItems);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Upcoming</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {days.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
            <CalendarClock
              aria-hidden
              className="size-6 text-muted-foreground"
            />
            <p className="text-small text-muted-foreground">
              Nothing coming up today or tomorrow.
            </p>
          </div>
        ) : (
          days.map((day) => (
            <div key={day.key} className="flex flex-col gap-2">
              <h2 className="font-heading text-h3 font-semibold">
                {day.label}
              </h2>
              <div className="flex flex-col gap-1">
                {day.items.map((item) => (
                  <AgendaItemRow key={item.event.id} item={item} />
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
      <CardFooter>
        <Link
          href="/calendar?view=day"
          className="text-small font-medium text-primary hover:underline"
        >
          View calendar →
        </Link>
      </CardFooter>
    </Card>
  );
}
