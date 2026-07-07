"use client";

import { format, isSameDay } from "date-fns";

import { cn } from "@/lib/utils";
import { eventOverlapsDay } from "@/lib/calendar/segments";
import type { CalendarEvent } from "@/lib/calendar/types";

import { AllDayRow } from "./all-day-row";
import { DayColumn } from "./day-column";
import { EventChip } from "./event-chip";
import { TimeGutter } from "./time-gutter";
import { useEventReschedule } from "./use-event-reschedule";

interface WeekViewProps {
  days: Date[];
  events: CalendarEvent[];
  now: Date;
}

export function WeekView({ days, events, now }: WeekViewProps) {
  const { events: liveEvents, reschedule } = useEventReschedule(events);
  const allDayEvents = liveEvents.filter((event) => event.allDay);
  const timedEvents = liveEvents.filter((event) => !event.allDay);

  return (
    <>
      {/* Phone: stacked agenda-style list — a 7-column grid is unreadable this narrow. */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto md:hidden">
        {days.map((day) => {
          const dayEvents = liveEvents
            .filter((event) => eventOverlapsDay(event, day))
            .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

          return (
            <div key={day.toISOString()} className="flex flex-col gap-2">
              <h2
                className={cn(
                  "flex items-baseline gap-2 font-heading text-h3 font-semibold",
                  isSameDay(day, now) && "text-primary"
                )}
              >
                {format(day, "EEEE")}
                <span className="font-mono text-small text-muted-foreground">
                  {format(day, "MMM d")}
                </span>
              </h2>
              {dayEvents.length === 0 ? (
                <p className="text-small text-muted-foreground">No events</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {dayEvents.map((event) => (
                    <EventChip key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop/tablet: classic 7-column time grid. */}
      <div className="hidden flex-1 flex-col overflow-hidden rounded-2xl border border-border md:flex">
        <div className="flex border-b border-border">
          <div className="w-12 shrink-0 sm:w-14" />
          <div className="grid flex-1 grid-cols-7">
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "border-l border-border py-2 text-center first:border-l-0",
                  isSameDay(day, now) && "bg-secondary"
                )}
              >
                <p className="text-caption text-muted-foreground">
                  {format(day, "EEE")}
                </p>
                <p
                  className={cn(
                    "font-heading text-h3 font-semibold",
                    isSameDay(day, now) && "text-primary"
                  )}
                >
                  {format(day, "d")}
                </p>
              </div>
            ))}
          </div>
        </div>
        <AllDayRow days={days} events={allDayEvents} />
        <div className="flex flex-1 overflow-y-auto">
          <TimeGutter />
          <div className="grid flex-1 grid-cols-7">
            {days.map((day) => (
              <DayColumn
                key={day.toISOString()}
                day={day}
                events={timedEvents}
                now={now}
                crossDayDrag
                onReschedule={reschedule}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
