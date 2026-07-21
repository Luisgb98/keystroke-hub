"use client";

import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { moveEventByDays, type TimeShift } from "@/lib/calendar/drag";
import type { CalendarEvent } from "@/lib/calendar/types";

import { EventEditor } from "./event-editor";
import { TRACK_ICON, TRACK_LABEL, TRACK_SURFACE_CLASSES } from "./track-styles";
import { useEventDrag } from "./use-event-drag";

interface EventChipProps {
  event: CalendarEvent;
  className?: string;
  /** Present only when the parent grid (month view) wants cross-day drag enabled. */
  onReschedule?: (shift: TimeShift) => void;
}

interface CellGeometry {
  width: number;
  height: number;
}

function measureCellGeometry(el: Element | null): CellGeometry {
  const rect = el?.getBoundingClientRect();
  return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
}

/** Compact, tappable event representation for month cells and all-day rows — opens its own edit dialog; draggable across day cells when `onReschedule` is given. */
export function EventChip({ event, className, onReschedule }: EventChipProps) {
  const [open, setOpen] = useState(false);
  const [gestureDelta, setGestureDelta] = useState<{
    dx: number;
    dy: number;
  } | null>(null);
  const geometryRef = useRef<CellGeometry>({ width: 0, height: 0 });
  const Icon = TRACK_ICON[event.track];

  function deltaDaysFrom(dx: number, dy: number): number {
    const { width, height } = geometryRef.current;
    if (width <= 0 || height <= 0) return 0;
    // Month cells form a 7-column grid — a vertical row shift is 7 days.
    return Math.round(dy / height) * 7 + Math.round(dx / width);
  }

  const drag = useEventDrag({
    disabled: !onReschedule,
    onDragMove: (delta) => setGestureDelta(delta),
    onDragEnd: ({ dx, dy }) => {
      setGestureDelta(null);
      onReschedule?.(moveEventByDays(event, deltaDaysFrom(dx, dy)));
    },
    onDragCancel: () => setGestureDelta(null),
  });

  const previewStyle: CSSProperties | undefined = gestureDelta
    ? {
        position: "relative",
        zIndex: 30,
        transform: `translate(${gestureDelta.dx}px, ${gestureDelta.dy}px)`,
      }
    : undefined;

  return (
    <>
      <button
        type="button"
        data-slot="event-chip"
        onPointerDown={(e) => {
          if (!onReschedule) return;
          geometryRef.current = measureCellGeometry(
            e.currentTarget.closest('[data-slot="month-cell"]')
          );
          drag.onPointerDown(e);
        }}
        onClick={() => {
          if (drag.consumeClickAfterDrag()) return;
          setOpen(true);
        }}
        style={previewStyle}
        className={cn(
          "flex min-h-[1.75rem] min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-left text-caption",
          TRACK_SURFACE_CLASSES[event.track],
          gestureDelta && "shadow-md",
          className
        )}
      >
        <Icon aria-hidden className="size-3 shrink-0" />
        <span className="sr-only">{TRACK_LABEL[event.track]}: </span>
        <span className="truncate">{event.title}</span>
        {event.conflictNote ? (
          <span
            role="img"
            aria-label="Sync conflict was resolved on this event"
            title={event.conflictNote}
          >
            <AlertTriangle aria-hidden className="size-3 shrink-0" />
          </span>
        ) : null}
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
