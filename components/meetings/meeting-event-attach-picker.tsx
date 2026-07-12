"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  attachEventToMeetingNote,
  searchAttachableEvents,
} from "@/lib/meetings/actions";
import type { AttachableEvent } from "@/lib/data/meeting-notes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface MeetingEventAttachPickerProps {
  meetingNoteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Searchable work-track event picker for `MeetingNoteEventSection` — mirrors
 * `EventAttachPicker` in `components/content/streams`, scoped to the work
 * track instead of content (see docs/meetings.md).
 */
export function MeetingEventAttachPicker({
  meetingNoteId,
  open,
  onOpenChange,
}: MeetingEventAttachPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AttachableEvent[]>([]);
  const [resultsKey, setResultsKey] = useState<string | null>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loading = open && resultsKey !== query;

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setQuery("");
      setResults([]);
      setResultsKey(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    searchAttachableEvents(query).then((events) => {
      if (cancelled) return;
      setResults(events);
      setResultsKey(query);
    });
    return () => {
      cancelled = true;
    };
  }, [open, query]);

  function handleAttach(event: AttachableEvent) {
    setAttachingId(event.id);
    startTransition(async () => {
      const result = await attachEventToMeetingNote(meetingNoteId, event.id);
      setAttachingId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Attached to "${event.title}"`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Attach an event</DialogTitle>
          <DialogDescription>
            Search your work-track calendar events and attach one to this
            meeting note.
          </DialogDescription>
        </DialogHeader>

        <Input
          autoFocus
          placeholder="Search events…"
          aria-label="Search events"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-small text-muted-foreground">
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-small text-muted-foreground">
              {query ? "No matching events." : "No events left to attach."}
            </p>
          ) : (
            results.map((event) => (
              <button
                key={event.id}
                type="button"
                disabled={pending && attachingId === event.id}
                onClick={() => handleAttach(event)}
                className="flex flex-col items-start gap-1 rounded-lg px-2 py-2 text-left hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="text-small font-medium">{event.title}</span>
                <span className="text-caption text-muted-foreground">
                  {event.allDay
                    ? format(event.startsAt, "MMM d, yyyy")
                    : format(event.startsAt, "MMM d, yyyy HH:mm")}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
