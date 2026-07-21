"use client";

import { useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { X } from "lucide-react";
import { toast } from "sonner";

import { formatDateParam } from "@/lib/calendar/range";
import {
  linkIdeaToEvent,
  unlinkIdeaFromEvent,
} from "@/lib/content/link-actions";
import type { ScheduledEventSummary } from "@/lib/data/idea-event-links";

interface IdeaScheduledEventsProps {
  ideaId: string;
  scheduledEvents: ScheduledEventSummary[];
}

/**
 * "Scheduled" chips on `IdeaCard` — the idea side of the link (see
 * docs/content-links.md). No idea detail page exists yet, so this mounts
 * directly on the card rather than a dedicated surface.
 */
export function IdeaScheduledEvents({
  ideaId,
  scheduledEvents,
}: IdeaScheduledEventsProps) {
  const [pending, startTransition] = useTransition();

  if (scheduledEvents.length === 0) return null;

  function handleUnlink(event: ScheduledEventSummary) {
    startTransition(async () => {
      const result = await unlinkIdeaFromEvent(event.id, ideaId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast(`Removed from "${event.title}"`, {
        action: {
          label: "Undo",
          onClick: () => {
            startTransition(async () => {
              const undoResult = await linkIdeaToEvent(event.id, ideaId);
              if (undoResult.error) toast.error(undoResult.error);
            });
          },
        },
      });
    });
  }

  return (
    <div data-slot="idea-scheduled-events" className="flex flex-wrap gap-1.5">
      {scheduledEvents.map((event) => (
        <span
          key={event.id}
          className="inline-flex items-center gap-1 rounded-full border border-track-content-border bg-track-content px-2 py-0.5 text-caption text-track-content-foreground"
        >
          <Link
            href={`/calendar?view=day&date=${formatDateParam(event.startsAt)}`}
            className="hover:underline"
          >
            {event.allDay
              ? format(event.startsAt, "MMM d")
              : format(event.startsAt, "MMM d, HH:mm")}
          </Link>
          <button
            type="button"
            aria-label={`Unlink from "${event.title}"`}
            disabled={pending}
            onClick={() => handleUnlink(event)}
            className="opacity-60 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
          >
            <X aria-hidden className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
