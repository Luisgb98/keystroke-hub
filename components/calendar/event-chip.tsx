import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/calendar/types";

import { TRACK_ICON, TRACK_LABEL, TRACK_SURFACE_CLASSES } from "./track-styles";

interface EventChipProps {
  event: CalendarEvent;
  className?: string;
}

/** Compact event representation for month cells and all-day rows. */
export function EventChip({ event, className }: EventChipProps) {
  const Icon = TRACK_ICON[event.track];

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-caption",
        TRACK_SURFACE_CLASSES[event.track],
        className
      )}
    >
      <Icon aria-hidden className="size-3 shrink-0" />
      <span className="sr-only">{TRACK_LABEL[event.track]}: </span>
      <span className="truncate">{event.title}</span>
    </div>
  );
}
