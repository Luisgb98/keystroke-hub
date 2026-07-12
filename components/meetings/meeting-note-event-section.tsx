"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { CalendarDays, Unlink } from "lucide-react";
import { toast } from "sonner";

import { detachEventFromMeetingNote } from "@/lib/meetings/actions";
import type { LinkedEventSummary } from "@/lib/data/meeting-notes";
import { Button } from "@/components/ui/button";

import { MeetingEventAttachPicker } from "./meeting-event-attach-picker";

interface MeetingNoteEventSectionProps {
  meetingNoteId: string;
  event: LinkedEventSummary | null;
}

/**
 * Linked work-track calendar event — at most one, enforced at the DB level
 * by `meeting_notes_event_id_unique` (see docs/meetings.md).
 */
export function MeetingNoteEventSection({
  meetingNoteId,
  event,
}: MeetingNoteEventSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDetach() {
    startTransition(async () => {
      const result = await detachEventFromMeetingNote(meetingNoteId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast("Event detached");
    });
  }

  return (
    <section
      data-slot="meeting-note-event"
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-small font-semibold">Calendar event</h2>
        {!event ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => setPickerOpen(true)}
          >
            Attach an event
          </Button>
        ) : null}
      </div>

      {event ? (
        <div className="flex items-center gap-2 rounded-md bg-background/70 px-2 py-1.5">
          <CalendarDays
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <span className="flex-1 truncate text-small">
            {event.title}{" "}
            <span className="font-mono text-caption text-muted-foreground">
              {event.allDay
                ? format(event.startsAt, "MMM d, yyyy")
                : format(event.startsAt, "MMM d, yyyy HH:mm")}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Detach event"
            disabled={pending}
            onClick={handleDetach}
          >
            <Unlink aria-hidden className="size-3.5" />
          </Button>
        </div>
      ) : (
        <p className="text-caption text-muted-foreground">
          No event attached yet.
        </p>
      )}

      <MeetingEventAttachPicker
        meetingNoteId={meetingNoteId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </section>
  );
}
