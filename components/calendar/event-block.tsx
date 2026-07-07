import { format } from "date-fns";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import type { DaySegment } from "@/lib/calendar/segments";

import { TRACK_ICON, TRACK_LABEL, TRACK_SURFACE_CLASSES } from "./track-styles";

interface EventBlockProps {
  segment: DaySegment;
  style: CSSProperties;
}

/** A timed event positioned absolutely within a day/week time-grid column. */
export function EventBlock({ segment, style }: EventBlockProps) {
  const { event, start, end } = segment;
  const Icon = TRACK_ICON[event.track];

  return (
    <div
      className={cn(
        "absolute overflow-hidden rounded-md border px-1.5 py-1 text-caption leading-tight",
        TRACK_SURFACE_CLASSES[event.track]
      )}
      style={style}
    >
      <div className="flex items-center gap-1 font-medium">
        <Icon aria-hidden className="size-3 shrink-0" />
        <span className="sr-only">{TRACK_LABEL[event.track]}: </span>
        <span className="truncate">{event.title}</span>
      </div>
      <p className="truncate font-mono text-[0.65rem] opacity-80">
        {format(start, "HH:mm")}–{format(end, "HH:mm")}
      </p>
    </div>
  );
}
