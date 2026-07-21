"use client";

import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { HOUR_HEIGHT_REM, MINUTES_IN_DAY } from "@/lib/calendar/constants";
import {
  moveEvent,
  resizeEvent,
  snapMinutes,
  type TimeShift,
} from "@/lib/calendar/drag";
import {
  clampEventToDay,
  minutesSinceMidnight,
  type DaySegment,
} from "@/lib/calendar/segments";

import { EventEditor } from "./event-editor";
import { TRACK_ICON, TRACK_LABEL, TRACK_SURFACE_CLASSES } from "./track-styles";
import { useEventDrag } from "./use-event-drag";

interface EventBlockProps {
  segment: DaySegment;
  style: CSSProperties;
  /** The day this column renders — clamps a live resize preview to day bounds. */
  day?: Date;
  /** Enables horizontal (day-to-day) move — only meaningful in a multi-column week grid. */
  crossDayDrag?: boolean;
  /** Present only when the parent view wants drag/resize enabled for this block. */
  onReschedule?: (shift: TimeShift) => void;
}

type Gesture =
  | {
      kind: "move";
      deltaDays: number;
      deltaMinutes: number;
      pxPerMinute: number;
      columnWidthPx: number;
    }
  | { kind: "resize-start" | "resize-end"; deltaMinutes: number };

interface Geometry {
  pxPerMinute: number;
  columnWidthPx: number;
}

/**
 * Resolves rem->px from the live root font size at drag start (rather than
 * hardcoding 16px/rem) so the conversion never drifts from CSS, matching
 * `HOUR_HEIGHT_REM`'s `h-16` Tailwind class in day-column.tsx.
 */
function measureGeometry(columnEl: Element | null): Geometry {
  const rootFontSizePx =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return {
    pxPerMinute: (HOUR_HEIGHT_REM * rootFontSizePx) / 60,
    columnWidthPx: columnEl?.getBoundingClientRect().width ?? 0,
  };
}

/** A timed event positioned absolutely within a day/week time-grid column — draggable, resizable, and tappable to open its edit dialog. */
export function EventBlock({
  segment,
  style,
  day,
  crossDayDrag = false,
  onReschedule,
}: EventBlockProps) {
  const [open, setOpen] = useState(false);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const geometryRef = useRef<Geometry>({ pxPerMinute: 0, columnWidthPx: 0 });
  const { event, start, end } = segment;
  const Icon = TRACK_ICON[event.track];

  const canResizeStart = segment.start.getTime() === event.startsAt.getTime();
  const canResizeEnd = segment.end.getTime() === event.endsAt.getTime();

  function startGesture(el: Element) {
    geometryRef.current = measureGeometry(
      crossDayDrag ? el.closest('[data-slot="day-column"]') : null
    );
  }

  const move = useEventDrag({
    disabled: !onReschedule,
    onDragMove: ({ dx, dy }) => {
      const { pxPerMinute, columnWidthPx } = geometryRef.current;
      setGesture({
        kind: "move",
        deltaMinutes: pxPerMinute > 0 ? dy / pxPerMinute : 0,
        deltaDays:
          crossDayDrag && columnWidthPx > 0
            ? Math.round(dx / columnWidthPx)
            : 0,
        pxPerMinute,
        columnWidthPx,
      });
    },
    onDragEnd: ({ dx, dy }) => {
      const { pxPerMinute, columnWidthPx } = geometryRef.current;
      const deltaMinutes = pxPerMinute > 0 ? dy / pxPerMinute : 0;
      const deltaDays =
        crossDayDrag && columnWidthPx > 0 ? Math.round(dx / columnWidthPx) : 0;
      setGesture(null);
      onReschedule?.(moveEvent(event, deltaDays, deltaMinutes));
    },
    onDragCancel: () => setGesture(null),
  });

  const resizeStart = useEventDrag({
    disabled: !onReschedule,
    onDragMove: ({ dy }) => {
      const { pxPerMinute } = geometryRef.current;
      setGesture({
        kind: "resize-start",
        deltaMinutes: pxPerMinute > 0 ? dy / pxPerMinute : 0,
      });
    },
    onDragEnd: ({ dy }) => {
      const { pxPerMinute } = geometryRef.current;
      setGesture(null);
      onReschedule?.(
        resizeEvent(event, "start", pxPerMinute > 0 ? dy / pxPerMinute : 0)
      );
    },
    onDragCancel: () => setGesture(null),
  });

  const resizeEnd = useEventDrag({
    disabled: !onReschedule,
    onDragMove: ({ dy }) => {
      const { pxPerMinute } = geometryRef.current;
      setGesture({
        kind: "resize-end",
        deltaMinutes: pxPerMinute > 0 ? dy / pxPerMinute : 0,
      });
    },
    onDragEnd: ({ dy }) => {
      const { pxPerMinute } = geometryRef.current;
      setGesture(null);
      onReschedule?.(
        resizeEvent(event, "end", pxPerMinute > 0 ? dy / pxPerMinute : 0)
      );
    },
    onDragCancel: () => setGesture(null),
  });

  const previewShift: TimeShift | null = useMemo(() => {
    if (!gesture) return null;
    if (gesture.kind === "move") {
      return moveEvent(event, gesture.deltaDays, gesture.deltaMinutes);
    }
    return resizeEvent(
      event,
      gesture.kind === "resize-start" ? "start" : "end",
      gesture.deltaMinutes
    );
  }, [gesture, event]);

  const previewStyle: CSSProperties = useMemo(() => {
    if (!gesture) return style;

    if (gesture.kind === "move") {
      const translateY =
        snapMinutes(gesture.deltaMinutes) * gesture.pxPerMinute;
      const translateX = gesture.deltaDays * gesture.columnWidthPx;
      return {
        ...style,
        transform: `translate(${translateX}px, ${translateY}px)`,
      };
    }

    if (!day || !previewShift) return style;
    const previewSegment = clampEventToDay({ ...event, ...previewShift }, day);
    const previewStart = minutesSinceMidnight(previewSegment.start);
    const previewEnd = minutesSinceMidnight(previewSegment.end);
    return {
      ...style,
      top: `${(previewStart / MINUTES_IN_DAY) * 100}%`,
      height: `${Math.max((previewEnd - previewStart) / MINUTES_IN_DAY, 0.02) * 100}%`,
    };
  }, [gesture, style, day, event, previewShift]);

  const timeLabel = previewShift
    ? `${format(previewShift.startsAt, "HH:mm")}–${format(previewShift.endsAt, "HH:mm")}`
    : `${format(start, "HH:mm")}–${format(end, "HH:mm")}`;

  return (
    <>
      <button
        type="button"
        data-slot="event-block"
        onPointerDown={(e) => {
          if (!onReschedule) return;
          startGesture(e.currentTarget);
          move.onPointerDown(e);
        }}
        onClick={() => {
          if (move.consumeClickAfterDrag()) return;
          setOpen(true);
        }}
        className={cn(
          "absolute overflow-hidden rounded-md border px-1.5 py-1 text-left text-caption leading-tight",
          TRACK_SURFACE_CLASSES[event.track],
          gesture ? "z-20 shadow-md" : "z-10"
        )}
        style={previewStyle}
      >
        {onReschedule && canResizeStart ? (
          <div
            role="presentation"
            aria-hidden
            data-slot="resize-start-handle"
            className="absolute inset-x-0 top-0 z-10 h-2"
            style={{ cursor: "ns-resize" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              startGesture(e.currentTarget);
              resizeStart.onPointerDown(e);
            }}
          />
        ) : null}

        <div className="flex items-center gap-1 font-medium">
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
        </div>
        <p className="truncate font-mono text-[0.65rem] opacity-80">
          {timeLabel}
        </p>

        {onReschedule && canResizeEnd ? (
          <div
            role="presentation"
            aria-hidden
            data-slot="resize-end-handle"
            className="absolute inset-x-0 bottom-0 z-10 h-2"
            style={{ cursor: "ns-resize" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              startGesture(e.currentTarget);
              resizeEnd.onPointerDown(e);
            }}
          />
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
