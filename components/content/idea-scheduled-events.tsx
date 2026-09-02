"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { toast } from "sonner";

import { formatDateParam } from "@/lib/calendar/range";
import { rescheduleIdeaRelease } from "@/lib/content/actions";
import {
  linkIdeaToEvent,
  unlinkIdeaFromEvent,
} from "@/lib/content/link-actions";
import type { ScheduledEventSummary } from "@/lib/data/idea-event-links";
import {
  formatAppDateParam,
  formatAppTimeParam,
  formatInAppZone,
  parseAppDateTime,
} from "@/lib/time";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TimePicker } from "@/components/ui/time-picker";

interface IdeaScheduledEventsProps {
  ideaId: string;
  scheduledEvents: ScheduledEventSummary[];
  /**
   * The idea's own release event, when it has one. That single chip becomes a
   * reschedule control instead of a calendar link (#102) — every other chip
   * points at an event the idea merely links to, which this surface doesn't own.
   */
  releaseEventId?: string | null;
}

/** The chip's text: a release is a moment, an all-day event is just a day. */
function chipLabel(event: ScheduledEventSummary): string {
  return event.allDay
    ? formatInAppZone(event.startsAt, "MMM d")
    : formatInAppZone(event.startsAt, "MMM d, HH:mm");
}

/**
 * The release chip: shows the publish slot and opens a date + time picker in
 * place to move it (#102). Shifting a release is the most frequent edit a
 * content schedule takes, and it used to cost a trip through the whole edit
 * dialog — this is the same mutation at one tap from the card.
 *
 * The chip's own click is the trigger, so unlike every other chip it doesn't
 * link to the calendar day. That link is what the calendar's own navigation is
 * for; the reschedule is what this surface can't otherwise offer.
 */
function ReleaseChip({
  ideaId,
  event,
}: {
  ideaId: string;
  event: ScheduledEventSummary;
}) {
  const label = chipLabel(event);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => formatAppDateParam(event.startsAt));
  const [time, setTime] = useState(() => formatAppTimeParam(event.startsAt));
  const [pending, startTransition] = useTransition();

  // Re-seed the fields on each open rather than only at mount: a save
  // revalidates the page, so the next open must offer the slot that's actually
  // stored. Adjusted during render (this component's own state) rather than in
  // an effect — the same idiom as EventEditor, minus the extra render pass.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDate(formatAppDateParam(event.startsAt));
      setTime(formatAppTimeParam(event.startsAt));
    }
  }

  function handleSave() {
    const moved = parseAppDateTime(date, time);
    startTransition(async () => {
      const result = await rescheduleIdeaRelease(ideaId, date, time);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(
        moved
          ? `Release moved to ${formatInAppZone(moved, "MMM d, HH:mm")}`
          : "Release moved"
      );
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            // The visible text is a date, which says nothing about what
            // clicking it does — spell that out for assistive tech, and keep
            // the current slot in the name so it's still announced.
            aria-label={`Reschedule release, currently ${label}`}
          />
        }
        // Fills the chip's height so the tap target is the whole chip, not
        // just the 17px line of text inside it (#114).
        className="flex h-full items-center rounded-full hover:underline"
      >
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <PopoverHeader>
          <PopoverTitle>Reschedule release</PopoverTitle>
        </PopoverHeader>
        {/* Field names stay short and distinct from the edit dialog's "Release
            date"/"Release time": Playwright's `getByLabel` matches substrings,
            so overlapping names would make every existing query ambiguous
            while a card's editor is open (see DatePicker's `triggerLabel`). */}
        <DatePicker
          aria-label="New day"
          triggerLabel="Open reschedule calendar"
          value={date}
          onChange={setDate}
        />
        <TimePicker
          aria-label="New time"
          triggerLabel="Choose reschedule time"
          value={time}
          onChange={setTime}
        />
        <Button
          type="button"
          size="sm"
          disabled={pending || !date || !time}
          onClick={handleSave}
        >
          {pending ? "Moving…" : "Move release"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * "Scheduled" chips on `IdeaCard` and the idea detail page — the idea side of
 * the link (see docs/content-ideas.md). Chips for linked events open the
 * calendar day they sit on; the idea's own release chip reschedules in place
 * (see `ReleaseChip`).
 */
export function IdeaScheduledEvents({
  ideaId,
  scheduledEvents,
  releaseEventId,
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
          // `min-h-11` on a phone: the chip carries two controls (open the
          // day, unlink) and at 17px tall neither was reliably tappable (#114).
          className="inline-flex min-h-11 items-center gap-1 rounded-full border border-track-content-border bg-track-content px-2.5 py-0.5 text-caption text-track-content-foreground md:min-h-0 md:px-2"
        >
          {releaseEventId && event.id === releaseEventId ? (
            <ReleaseChip ideaId={ideaId} event={event} />
          ) : (
            <Link
              href={`/calendar?view=day&date=${formatDateParam(event.startsAt)}`}
              className="flex h-full items-center hover:underline"
            >
              {chipLabel(event)}
            </Link>
          )}
          <button
            type="button"
            aria-label={`Unlink from "${event.title}"`}
            disabled={pending}
            onClick={() => handleUnlink(event)}
            className="-mr-1 flex size-8 items-center justify-center rounded-full opacity-60 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30 md:mr-0 md:size-auto"
          >
            <X aria-hidden className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
