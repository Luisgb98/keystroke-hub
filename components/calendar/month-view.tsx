"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { MONTH_CELL_MAX_CHIPS } from "@/lib/calendar/constants";
import type { TimeShift } from "@/lib/calendar/drag";
import { quickAddFromDayCell } from "@/lib/calendar/quick-add";
import { formatDateParam } from "@/lib/calendar/range";
import { eventOverlapsDay } from "@/lib/calendar/segments";
import type { CalendarEvent } from "@/lib/calendar/types";
import { appIsSameDay, appIsSameMonth, formatInAppZone } from "@/lib/time";

import { EventChip } from "./event-chip";
import { EventEditor } from "./event-editor";
import { useEventReschedule } from "./use-event-reschedule";

interface MonthViewProps {
  days: Date[];
  /** The month currently being viewed, for dimming days that spill from adjacent months. */
  anchorMonth: Date;
  events: CalendarEvent[];
  now: Date;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthView({ days, anchorMonth, events, now }: MonthViewProps) {
  const { events: liveEvents, reschedule } = useEventReschedule(events);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border">
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
      {/* The only scrollport in this view — the weekday header above stays
          pinned, and on a short window the 6 rows of `min-h-20` cells scroll in
          here rather than growing the page (issue #87). */}
      <div
        data-slot="calendar-scroll"
        className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 overflow-y-auto"
      >
        {days.map((day) => {
          const dayEvents = liveEvents
            .filter((event) => eventOverlapsDay(event, day))
            .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
          const visible = dayEvents.slice(0, MONTH_CELL_MAX_CHIPS);
          const overflowCount = dayEvents.length - visible.length;
          const inAnchorMonth = appIsSameMonth(day, anchorMonth);
          const isToday = appIsSameDay(day, now);

          return (
            <MonthCell
              key={day.toISOString()}
              day={day}
              visible={visible}
              overflowCount={overflowCount}
              inAnchorMonth={inAnchorMonth}
              isToday={isToday}
              onReschedule={reschedule}
            />
          );
        })}
      </div>
    </div>
  );
}

interface MonthCellProps {
  day: Date;
  visible: CalendarEvent[];
  overflowCount: number;
  inAnchorMonth: boolean;
  isToday: boolean;
  onReschedule: (event: CalendarEvent, shift: TimeShift) => void;
}

/**
 * The `Link` (day navigation) and the interactive chip/quick-add content are
 * siblings, not parent/child — nesting a `<button>` (`EventChip`) inside an
 * `<a>` would be invalid HTML. The `Link` is a full-bleed absolutely
 * positioned overlay; chips and the "+" button sit above it (`z-10`) so
 * their own clicks win, while empty cell area falls through to the `Link`.
 */
function MonthCell({
  day,
  visible,
  overflowCount,
  inAnchorMonth,
  isToday,
  onReschedule,
}: MonthCellProps) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  return (
    <div
      data-slot="month-cell"
      className={cn(
        "group relative flex min-h-20 flex-col gap-1 border-t border-l border-border p-1.5 first:border-l-0 [&:nth-child(7n+1)]:border-l-0",
        !inAnchorMonth && "bg-muted/30"
      )}
    >
      <Link
        href={`/calendar?view=day&date=${formatDateParam(day)}`}
        aria-label={formatInAppZone(day, "EEEE, MMMM d, yyyy")}
        className="absolute inset-0 z-0 hover:bg-muted/50"
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none relative z-10 flex size-6 items-center justify-center rounded-full text-small",
          !inAnchorMonth && "text-muted-foreground",
          isToday && "bg-primary font-semibold text-primary-foreground"
        )}
      >
        {formatInAppZone(day, "d")}
      </span>
      <div className="relative z-10 flex min-w-0 flex-col gap-0.5">
        {visible.map((event) => (
          <EventChip
            key={event.id}
            event={event}
            onReschedule={(shift) => onReschedule(event, shift)}
          />
        ))}
        {overflowCount > 0 && (
          <span className="text-caption text-muted-foreground">
            +{overflowCount} more
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label={`Add event on ${formatInAppZone(day, "MMMM d, yyyy")}`}
        onClick={() => setQuickAddOpen(true)}
        // Hover-revealed on desktop, permanently visible on a phone — a
        // pointer can't reveal it there, so before #114 the only way to add an
        // event to a month cell on touch was to tap an invisible 24px target.
        className="absolute top-1 right-1 z-10 flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border hover:text-foreground focus-visible:opacity-100 md:size-6 md:opacity-0 md:group-hover:opacity-100"
      >
        <Plus aria-hidden className="size-3.5" />
      </button>
      <EventEditor
        mode="create"
        defaults={quickAddFromDayCell(day)}
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
      />
    </div>
  );
}
