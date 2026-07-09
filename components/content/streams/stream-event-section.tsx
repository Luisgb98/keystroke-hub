"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Unlink } from "lucide-react";
import { toast } from "sonner";

import { formatDateParam } from "@/lib/calendar/range";
import { detachEventFromStream } from "@/lib/content/stream-actions";
import type { StreamEventSummary } from "@/lib/data/streams";
import { Button } from "@/components/ui/button";

import { EventAttachPicker } from "./event-attach-picker";

interface StreamEventSectionProps {
  streamId: string;
  event: StreamEventSummary | null;
}

/** "Scheduled" section on the stream detail page — attach/detach a content-track event (see docs/content-streams.md). */
export function StreamEventSection({
  streamId,
  event,
}: StreamEventSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDetach() {
    startTransition(async () => {
      const result = await detachEventFromStream(streamId);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div
      data-slot="stream-event-section"
      className="flex flex-col gap-2 rounded-lg border border-track-content-border bg-track-content/40 p-3"
    >
      <h2 className="text-small font-semibold">Scheduled</h2>
      {event ? (
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/calendar?view=day&date=${formatDateParam(event.startsAt)}`}
            className="text-small hover:underline"
          >
            {event.allDay
              ? format(event.startsAt, "MMM d, yyyy")
              : format(event.startsAt, "MMM d, yyyy HH:mm")}
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Unschedule this stream"
            disabled={pending}
            onClick={handleDetach}
          >
            <Unlink aria-hidden className="size-3.5" />
          </Button>
        </div>
      ) : (
        <>
          <p className="text-caption text-muted-foreground">Unscheduled.</p>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="self-start"
            onClick={() => setPickerOpen(true)}
          >
            Attach an event
          </Button>
        </>
      )}

      <EventAttachPicker
        streamId={streamId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </div>
  );
}
