import Link from "next/link";
import { format, isSameDay, isSameMonth } from "date-fns";

import { cn } from "@/lib/utils";
import { MONTH_CELL_MAX_CHIPS } from "@/lib/calendar/constants";
import { formatDateParam } from "@/lib/calendar/range";
import { eventOverlapsDay } from "@/lib/calendar/segments";
import type { CalendarEvent } from "@/lib/calendar/types";

import { EventChip } from "./event-chip";

interface MonthViewProps {
  days: Date[];
  /** The month currently being viewed, for dimming days that spill from adjacent months. */
  anchorMonth: Date;
  events: CalendarEvent[];
  now: Date;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthView({ days, anchorMonth, events, now }: MonthViewProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-l border-border py-2 text-center text-caption text-muted-foreground first:border-l-0"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6 overflow-y-auto">
        {days.map((day) => {
          const dayEvents = events
            .filter((event) => eventOverlapsDay(event, day))
            .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
          const visible = dayEvents.slice(0, MONTH_CELL_MAX_CHIPS);
          const overflowCount = dayEvents.length - visible.length;
          const inAnchorMonth = isSameMonth(day, anchorMonth);
          const isToday = isSameDay(day, now);

          return (
            <Link
              key={day.toISOString()}
              href={`/calendar?view=day&date=${formatDateParam(day)}`}
              aria-label={format(day, "EEEE, MMMM d, yyyy")}
              className={cn(
                "flex min-h-20 flex-col gap-1 border-t border-l border-border p-1.5 first:border-l-0 hover:bg-muted/50 [&:nth-child(7n+1)]:border-l-0",
                !inAnchorMonth && "bg-muted/30"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-small",
                  !inAnchorMonth && "text-muted-foreground",
                  isToday && "bg-primary font-semibold text-primary-foreground"
                )}
              >
                {format(day, "d")}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                {visible.map((event) => (
                  <EventChip key={event.id} event={event} />
                ))}
                {overflowCount > 0 && (
                  <span className="text-caption text-muted-foreground">
                    +{overflowCount} more
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
