"use client";

import type { CalendarEvent } from "@/lib/calendar/types";

import { AllDayRow } from "./all-day-row";
import { DayColumn } from "./day-column";
import { TimeGutter } from "./time-gutter";
import { useEventReschedule } from "./use-event-reschedule";

interface DayViewProps {
  day: Date;
  events: CalendarEvent[];
  now: Date;
}

export function DayView({ day, events, now }: DayViewProps) {
  const { events: liveEvents, reschedule } = useEventReschedule(events);
  const allDayEvents = liveEvents.filter((event) => event.allDay);
  const timedEvents = liveEvents.filter((event) => !event.allDay);

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border">
      <AllDayRow days={[day]} events={allDayEvents} />
      <div className="flex flex-1 overflow-y-auto">
        <TimeGutter />
        <div className="flex-1">
          <DayColumn
            day={day}
            events={timedEvents}
            now={now}
            onReschedule={reschedule}
          />
        </div>
      </div>
    </div>
  );
}
