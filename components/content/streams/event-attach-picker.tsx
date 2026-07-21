"use client";

import { format } from "date-fns";

import {
  attachEventToStream,
  searchAttachableEvents,
} from "@/lib/content/stream-actions";
import type { AttachableEvent } from "@/lib/data/streams";
import { AttachPicker } from "@/components/shared/attach-picker";

interface EventAttachPickerProps {
  streamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Searchable content-track event picker for `StreamEventSection`. */
export function EventAttachPicker({
  streamId,
  open,
  onOpenChange,
}: EventAttachPickerProps) {
  return (
    <AttachPicker<AttachableEvent>
      open={open}
      onOpenChange={onOpenChange}
      title="Attach an event"
      description="Search your content-track calendar events and attach one to this stream."
      searchPlaceholder="Search events…"
      searchAriaLabel="Search events"
      search={(query) => searchAttachableEvents(query)}
      attach={(event) => attachEventToStream(streamId, event.id)}
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
