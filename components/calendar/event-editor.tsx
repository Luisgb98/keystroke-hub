"use client";

import {
  useActionState,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { createEvent, updateEvent } from "@/lib/calendar/actions";
import type { QuickAddDefaults } from "@/lib/calendar/quick-add";
import type { CalendarEvent, Track } from "@/lib/calendar/types";
import { dismissConflictNote } from "@/lib/sync/actions";
import { cn } from "@/lib/utils";
import { EventLinkedIdeas } from "@/components/content/event-linked-ideas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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

function dateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeParam(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

function initialValues(
  event: CalendarEvent | undefined,
  defaults: QuickAddDefaults | undefined
) {
  if (event) {
    return {
      track: event.track as Track | undefined,
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
    track: undefined as Track | undefined,
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
        <DialogContent className="sm:max-w-md">
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

            {mode === "edit" && event && values.track === "content" ? (
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
                <Input
                  id="event-start-date"
                  name="startDate"
                  type="date"
                  value={values.startDate}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, startDate: e.target.value }))
                  }
                />
                {!values.allDay ? (
                  <Input
                    name="startTime"
                    type="time"
                    aria-label="Start time"
                    required
                    value={values.startTime}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, startTime: e.target.value }))
                    }
                  />
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-end-date">End</Label>
                <Input
                  id="event-end-date"
                  name="endDate"
                  type="date"
                  value={values.endDate}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, endDate: e.target.value }))
                  }
                />
                {!values.allDay ? (
                  <Input
                    name="endTime"
                    type="time"
                    aria-label="End time"
                    required
                    value={values.endTime}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, endTime: e.target.value }))
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
