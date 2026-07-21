import { eventOverlapsDay } from "@/lib/calendar/segments";
import type { CalendarEvent } from "@/lib/calendar/types";

import { EventChip } from "./event-chip";

interface AllDayRowProps {
  days: Date[];
  events: CalendarEvent[];
}

/** Renders all-day events as chips in a row of columns aligned with the time grid below. */
export function AllDayRow({ days, events }: AllDayRowProps) {
  if (events.length === 0) return null;

  return (
    <div className="flex border-b border-border">
      {/* Spacer matching TimeGutter's width so chips align with their day column below. */}
      <div className="w-12 shrink-0 sm:w-14" />
      <div
        className="grid flex-1"
        style={{
          gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
        }}
      >
        {days.map((day) => {
          const dayEvents = events.filter((event) =>
            eventOverlapsDay(event, day)
          );
          return (
            <div
              key={day.toISOString()}
              className="flex min-h-8 flex-col gap-1 border-l border-border p-1 first:border-l-0"
            >
              {dayEvents.map((event) => (
                <EventChip key={event.id} event={event} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
