"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import type { AgendaItem } from "@/lib/calendar/agenda";
import { cn } from "@/lib/utils";

import { EventEditor } from "@/components/calendar/event-editor";
import {
  TRACK_ICON,
  TRACK_LABEL,
  TRACK_SURFACE_CLASSES,
} from "@/components/calendar/track-styles";

interface AgendaItemRowProps {
  item: AgendaItem;
}

/** One tappable agenda row — opens the same `EventEditor` dialog as the calendar's own event chips. */
export function AgendaItemRow({ item }: AgendaItemRowProps) {
  const [open, setOpen] = useState(false);
  const { event, timeLabel, inProgress } = item;
  const Icon = TRACK_ICON[event.track];

  return (
    <>
      <button
        type="button"
        data-slot="agenda-item"
        onClick={() => setOpen(true)}
        className={cn(
          "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-small",
          TRACK_SURFACE_CLASSES[event.track]
        )}
      >
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="sr-only">{TRACK_LABEL[event.track]}: </span>
        <span className="min-w-0 flex-1 truncate font-medium">
          {event.title}
        </span>
        {event.conflictNote ? (
          <span
            role="img"
            aria-label="Sync conflict was resolved on this event"
            title={event.conflictNote}
          >
            <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
          </span>
        ) : null}
        <span
          className={cn(
            "shrink-0 font-mono text-caption opacity-80",
            inProgress && "font-semibold opacity-100"
          )}
        >
          {timeLabel}
        </span>
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
