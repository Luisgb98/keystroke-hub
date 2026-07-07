"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/calendar/types";

import { EventEditor } from "./event-editor";
import { TRACK_ICON, TRACK_LABEL, TRACK_SURFACE_CLASSES } from "./track-styles";

interface EventChipProps {
  event: CalendarEvent;
  className?: string;
}

/** Compact, tappable event representation for month cells and all-day rows — opens its own edit dialog. */
export function EventChip({ event, className }: EventChipProps) {
  const [open, setOpen] = useState(false);
  const Icon = TRACK_ICON[event.track];

  return (
    <>
      <button
        type="button"
        data-slot="event-chip"
        onClick={() => setOpen(true)}
        className={cn(
          "flex min-h-[1.75rem] min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-left text-caption",
          TRACK_SURFACE_CLASSES[event.track],
          className
        )}
      >
        <Icon aria-hidden className="size-3 shrink-0" />
        <span className="sr-only">{TRACK_LABEL[event.track]}: </span>
        <span className="truncate">{event.title}</span>
      </button>
      <EventEditor
        mode="edit"
        event={event}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
