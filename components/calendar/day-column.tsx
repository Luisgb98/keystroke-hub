"use client";

import { useState } from "react";
import { format } from "date-fns";

import { DAY_GRID_HEIGHT_REM, HOURS_IN_DAY } from "@/lib/calendar/constants";
import { layoutTimedEvents } from "@/lib/calendar/layout";
import { quickAddFromSlot } from "@/lib/calendar/quick-add";
import {
  clampEventToDay,
  eventOverlapsDay,
  minutesSinceMidnight,
} from "@/lib/calendar/segments";
import type { CalendarEvent } from "@/lib/calendar/types";

import { EventBlock } from "./event-block";
import { EventEditor } from "./event-editor";
import { NowIndicator } from "./now-indicator";

interface DayColumnProps {
  day: Date;
  /** Timed (non-all-day) events for the whole visible range — filtered here to this day. */
  events: CalendarEvent[];
  now: Date;
}

const MINUTES_IN_DAY = HOURS_IN_DAY * 60;

/** A single day's vertical time grid: hour gridlines, positioned timed events, and the now-line. */
export function DayColumn({ day, events, now }: DayColumnProps) {
  const [quickAddHour, setQuickAddHour] = useState<number | null>(null);

  const segments = events
    .filter((event) => eventOverlapsDay(event, day))
    .map((event) => clampEventToDay(event, day));

  const layouts = layoutTimedEvents(
    segments.map((segment) => ({
      id: segment.event.id,
      start: minutesSinceMidnight(segment.start),
      end: minutesSinceMidnight(segment.end),
    }))
  );

  return (
    <div
      className="relative border-l border-border first:border-l-0"
      style={{ height: `${DAY_GRID_HEIGHT_REM}rem` }}
    >
      {Array.from({ length: HOURS_IN_DAY }, (_, hour) => (
        <div
          key={hour}
          aria-hidden
          className="absolute inset-x-0 border-t border-border"
          style={{ top: `${(hour / HOURS_IN_DAY) * 100}%` }}
        />
      ))}

      {Array.from({ length: HOURS_IN_DAY }, (_, hour) => (
        <button
          key={hour}
          type="button"
          aria-label={`Add event at ${hour}:00 on ${format(day, "MMMM d, yyyy")}`}
          onClick={() => setQuickAddHour(hour)}
          className="absolute inset-x-0 z-0 hover:bg-muted/40"
          style={{
            top: `${(hour / HOURS_IN_DAY) * 100}%`,
            height: `${(1 / HOURS_IN_DAY) * 100}%`,
          }}
        />
      ))}

      {segments.map((segment) => {
        const layout = layouts.find((l) => l.id === segment.event.id);
        const start = minutesSinceMidnight(segment.start);
        const end = minutesSinceMidnight(segment.end);
        const column = layout?.column ?? 0;
        const columnCount = layout?.columnCount ?? 1;

        return (
          <EventBlock
            key={segment.event.id}
            segment={segment}
            style={{
              top: `${(start / MINUTES_IN_DAY) * 100}%`,
              height: `${Math.max((end - start) / MINUTES_IN_DAY, 0.02) * 100}%`,
              left: `${(column / columnCount) * 100}%`,
              width: `${(1 / columnCount) * 100}%`,
            }}
          />
        );
      })}

      <NowIndicator day={day} initialNow={now} />

      {quickAddHour !== null ? (
        <EventEditor
          mode="create"
          defaults={quickAddFromSlot(day, quickAddHour)}
          open={quickAddHour !== null}
          onOpenChange={(open) => {
            if (!open) setQuickAddHour(null);
          }}
        />
      ) : null}
    </div>
  );
}
