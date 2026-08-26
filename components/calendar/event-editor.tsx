"use client";

import {
  useActionState,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { createEvent, updateEvent } from "@/lib/calendar/actions";
import type { QuickAddDefaults } from "@/lib/calendar/quick-add";
import { trackKindOf, type TrackKind } from "@/lib/calendar/track-kind";
import type { CalendarEvent } from "@/lib/calendar/types";
import { dismissConflictNote } from "@/lib/sync/actions";
import { formatAppDateParam, formatAppTimeParam } from "@/lib/time";
import { cn } from "@/lib/utils";
import { EventLinkedIdeas } from "@/components/content/event-linked-ideas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";

import { DeleteEventDialog } from "./delete-event-dialog";
import { TRACK_ICON, TRACK_LABEL, TRACK_SURFACE_CLASSES } from "./track-styles";
import { TrackPicker } from "./track-picker";

interface EventEditorProps {
  mode: "create" | "edit";
  event?: CalendarEvent;
  defaults?: QuickAddDefaults;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Prefill reads the stored instant back as app-timezone wall clock (see
 * lib/time). Using the raw `getFullYear`/`getHours` getters here would render
 * the server's own zone during SSR and the device's after hydration — the
 * form would show a different time than the calendar behind it (issue #95).
 */
const dateParam = formatAppDateParam;
const timeParam = formatAppTimeParam;

function initialValues(
  event: CalendarEvent | undefined,
  defaults: QuickAddDefaults | undefined
) {
  if (event) {
    return {
      track: trackKindOf(event) as TrackKind | undefined,
      title: event.title,
      description: event.description ?? "",
      allDay: event.allDay,
      startDate: dateParam(event.startsAt),
      startTime: event.allDay ? "" : timeParam(event.startsAt),
      endDate: dateParam(event.endsAt),
      endTime: event.allDay ? "" : timeParam(event.endsAt),
    };
  }

  return {
    track: undefined as TrackKind | undefined,
    title: "",
    description: "",
    allDay: defaults?.allDay ?? false,
    startDate: defaults?.startDate ?? dateParam(new Date()),
    startTime: defaults?.startTime ?? "",
    endDate: defaults?.endDate ?? dateParam(new Date()),
    endTime: defaults?.endTime ?? "",
  };
}

/**
 * Shared create/edit surface. Rendered inside the existing `Dialog` primitive
 * for both mobile and desktop — this project's shadcn setup (Base UI) has no
 * drawer/sheet component, and `DialogContent` is already responsive enough
 * for a mobile-first form (see docs/calendar.md).
 */
export function EventEditor({
  mode,
  event,
  defaults,
  open,
  onOpenChange,
}: EventEditorProps) {
  const titleId = useId();
  const action =
    mode === "edit" && event ? updateEvent.bind(null, event.id) : createEvent;
  const [state, formAction, pending] = useActionState(action, undefined);

  const [values, setValues] = useState(() => initialValues(event, defaults));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [conflictDismissed, setConflictDismissed] = useState(false);
  const [dismissPending, startDismissTransition] = useTransition();

  function handleDismissConflict() {
    if (!event) return;
    setConflictDismissed(true);
    startDismissTransition(() => dismissConflictNote(event.id));
  }

  // EventChip/EventBlock keep the same EventEditor instance mounted across
  // opens (only `open` toggles), so field values must be recomputed on each
  // open rather than only at mount. Adjusting state during render (rather
  // than in an effect) avoids an extra render pass — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setValues(initialValues(event, defaults));
      setConflictDismissed(false);
    }
  }

  useEffect(() => {
    if (state?.success) {
      const track = values.track;
      onOpenChange(false);
      if (track) {
        const Icon = TRACK_ICON[track];
        toast.custom(() => (
          <div
            data-slot="event-toast"
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm",
              TRACK_SURFACE_CLASSES[track]
            )}
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            <span>
              {TRACK_LABEL[track]}: <strong>{values.title}</strong> saved
            </span>
          </div>
        ));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErrors = state?.fieldErrors ?? {};
  const canSubmit = !pending && values.track !== undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent variant="sheet">
          <form action={formAction} className="flex flex-col gap-4" noValidate>
            <input type="hidden" name="track" value={values.track ?? ""} />
            <input type="hidden" name="allDay" value={String(values.allDay)} />

            <DialogHeader>
              <DialogTitle>
                {mode === "edit" ? "Edit event" : "New event"}
              </DialogTitle>
              <DialogDescription>
                Every event belongs to exactly one track.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              {mode === "edit" && event?.conflictNote && !conflictDismissed ? (
                <div className="flex items-start justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-caption text-destructive">
                  <p>{event.conflictNote}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={dismissPending}
                    onClick={handleDismissConflict}
                  >
                    Dismiss
                  </Button>
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <TrackPicker
                  value={values.track}
                  onChange={(track) => setValues((v) => ({ ...v, track }))}
                />
                {fieldErrors.track ? (
                  <p role="alert" className="text-small text-destructive">
                    {fieldErrors.track[0]}
                  </p>
                ) : null}
              </div>

              {mode === "edit" && event?.streamId ? (
                <Link
                  href={`/content/streams/${event.streamId}`}
                  data-slot="stream-session-link"
                  className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-track-stream-border bg-track-stream px-3 py-2 text-small font-medium text-track-stream-foreground hover:underline"
                >
                  Open stream session
                  <ExternalLink aria-hidden className="size-4 shrink-0" />
                </Link>
              ) : null}

              {mode === "edit" &&
              event &&
              (values.track === "content" || values.track === "stream") ? (
                <EventLinkedIdeas
                  eventId={event.id}
                  linkedIdeas={event.linkedIdeas}
                />
              ) : null}

              <div className="flex flex-col gap-2">
                <Label htmlFor={titleId}>Title</Label>
                <Input
                  id={titleId}
                  name="title"
                  autoFocus
                  value={values.title}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, title: e.target.value }))
                  }
                  aria-invalid={fieldErrors.title ? true : undefined}
                />
                {fieldErrors.title ? (
                  <p role="alert" className="text-small text-destructive">
                    {fieldErrors.title[0]}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="event-all-day">All day</Label>
                <Switch
                  id="event-all-day"
                  checked={values.allDay}
                  onCheckedChange={(allDay) =>
                    setValues((v) => ({ ...v, allDay }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="event-start-date">Start</Label>
                  <DatePicker
                    id="event-start-date"
                    name="startDate"
                    triggerLabel="Open starting day calendar"
                    value={values.startDate}
                    onChange={(startDate) =>
                      setValues((v) => ({ ...v, startDate }))
                    }
                  />
                  {!values.allDay ? (
                    <TimePicker
                      name="startTime"
                      aria-label="Start time"
                      triggerLabel="Choose starting time"
                      required
                      value={values.startTime}
                      onChange={(startTime) =>
                        setValues((v) => ({ ...v, startTime }))
                      }
                    />
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="event-end-date">End</Label>
                  <DatePicker
                    id="event-end-date"
                    name="endDate"
                    triggerLabel="Open ending day calendar"
                    value={values.endDate}
                    onChange={(endDate) =>
                      setValues((v) => ({ ...v, endDate }))
                    }
                  />
                  {!values.allDay ? (
                    <TimePicker
                      name="endTime"
                      aria-label="End time"
                      triggerLabel="Choose ending time"
                      required
                      value={values.endTime}
                      onChange={(endTime) =>
                        setValues((v) => ({ ...v, endTime }))
                      }
                    />
                  ) : null}
                </div>
              </div>
              {fieldErrors.startTime ||
              fieldErrors.endTime ||
              fieldErrors.endDate ? (
                <p role="alert" className="text-small text-destructive">
                  {
                    (fieldErrors.startTime ??
                      fieldErrors.endTime ??
                      fieldErrors.endDate)?.[0]
                  }
                </p>
              ) : null}

              <div className="flex flex-col gap-2">
                <Label htmlFor="event-description">Description</Label>
                <Textarea
                  id="event-description"
                  name="description"
                  value={values.description}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, description: e.target.value }))
                  }
                />
              </div>

              {state?.error ? (
                <p role="alert" className="text-small text-destructive">
                  {state.error}
                </p>
              ) : null}
            </DialogBody>
            <DialogFooter
              className={cn(mode === "edit" && "sm:justify-between")}
            >
              {mode === "edit" && event ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete
                </Button>
              ) : null}
              <Button type="submit" disabled={!canSubmit}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {mode === "edit" && event ? (
        <DeleteEventDialog
          event={event}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={() => {
            setDeleteOpen(false);
            onOpenChange(false);
          }}
        />
      ) : null}
    </>
  );
}
