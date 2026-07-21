"use client";

import { format } from "date-fns";

import {
  attachEventToMeetingNote,
  searchAttachableEvents,
} from "@/lib/meetings/actions";
import type { AttachableEvent } from "@/lib/data/meeting-notes";
import { AttachPicker } from "@/components/shared/attach-picker";

interface MeetingEventAttachPickerProps {
  meetingNoteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Searchable work-track event picker for `MeetingNoteEventSection`. */
export function MeetingEventAttachPicker({
  meetingNoteId,
  open,
  onOpenChange,
}: MeetingEventAttachPickerProps) {
  return (
    <AttachPicker<AttachableEvent>
      open={open}
      onOpenChange={onOpenChange}
      title="Attach an event"
      description="Search your work-track calendar events and attach one to this meeting note."
      searchPlaceholder="Search events…"
      searchAriaLabel="Search events"
      search={(query) => searchAttachableEvents(query)}
      attach={(event) => attachEventToMeetingNote(meetingNoteId, event.id)}
      getKey={(event) => event.id}
      getTitle={(event) => event.title}
      renderSubLabel={(event) => (
        <span className="text-caption text-muted-foreground">
          {event.allDay
            ? format(event.startsAt, "MMM d, yyyy")
            : format(event.startsAt, "MMM d, yyyy HH:mm")}
        </span>
      )}
      successMessage={(event) => `Attached to "${event.title}"`}
      emptyWithQuery="No matching events."
      emptyWithoutQuery="No events left to attach."
    />
  );
}
