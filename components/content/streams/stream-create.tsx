"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Plus, Radio } from "lucide-react";
import { toast } from "sonner";

import { createStream } from "@/lib/content/stream-actions";
import { useRegisterDockAction } from "@/components/shell/dock-action-provider";
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

const EMPTY_VALUES = {
  title: "",
  notes: "",
  planned: false,
  allDay: false,
  date: "",
  time: "19:00",
};

/**
 * The "New stream" primary action — same pattern as `IdeaCapture`: it owns the
 * capture dialog but registers its action with the shared capture dock rather
 * than rendering its own floating button (see docs/inbox.md and Issue #74).
 * Title is the only required field; planning a date is opt-in and, when on,
 * creates a content-track event with a fixed 2h duration rather than a second
 * end-time picker (see docs/content-streams.md).
 */
export function StreamCreate() {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  useRegisterDockAction("New stream", Plus, () => setOpen(true));
  const [values, setValues] = useState(EMPTY_VALUES);
  const [state, formAction, pending] = useActionState(createStream, undefined);
  const [capturedTitle, setCapturedTitle] = useState("");

  // Adjusting state during render on a `state` transition — same pattern as
  // `IdeaCapture`'s `prevState` handling — avoids an extra render pass.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) {
      setCapturedTitle(values.title);
      setOpen(false);
      setValues(EMPTY_VALUES);
    }
  }

  useEffect(() => {
    if (state?.success) {
      toast.custom(() => (
        <div
          data-slot="stream-toast"
          className="flex items-center gap-2 rounded-lg border border-track-content-border bg-track-content px-3 py-2 text-sm text-track-content-foreground shadow-sm"
        >
          <Radio aria-hidden className="size-4 shrink-0" />
          <span>
            Stream planned: <strong>{capturedTitle}</strong>
          </span>
        </div>
      ));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErrors = state?.fieldErrors ?? {};

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form action={formAction} className="flex flex-col gap-4" noValidate>
            <input
              type="hidden"
              name="planned"
              value={values.planned ? "true" : "false"}
            />
            <input
              type="hidden"
              name="allDay"
              value={values.allDay ? "true" : "false"}
            />

            <DialogHeader>
              <DialogTitle>New stream</DialogTitle>
              <DialogDescription>
                Plan the topic now — the date can wait.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor={titleId}>Topic</Label>
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="stream-notes">Prep notes</Label>
              <Textarea
                id="stream-notes"
                name="notes"
                value={values.notes}
                onChange={(e) =>
                  setValues((v) => ({ ...v, notes: e.target.value }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="stream-planned">Plan a date</Label>
              <Switch
                id="stream-planned"
                checked={values.planned}
                onCheckedChange={(planned) =>
                  setValues((v) => ({ ...v, planned }))
                }
              />
            </div>

            {values.planned ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="stream-all-day">All day</Label>
                  <Switch
                    id="stream-all-day"
                    checked={values.allDay}
                    onCheckedChange={(allDay) =>
                      setValues((v) => ({ ...v, allDay }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="stream-date">Date</Label>
                    <Input
                      id="stream-date"
                      name="date"
                      type="date"
                      value={values.date}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, date: e.target.value }))
                      }
                      aria-invalid={fieldErrors.date ? true : undefined}
                    />
                  </div>
                  {!values.allDay ? (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="stream-time">Start time</Label>
                      <Input
                        id="stream-time"
                        name="time"
                        type="time"
                        value={values.time}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, time: e.target.value }))
                        }
                        aria-invalid={fieldErrors.time ? true : undefined}
                      />
                    </div>
                  ) : null}
                </div>
                {fieldErrors.date || fieldErrors.time ? (
                  <p role="alert" className="text-small text-destructive">
                    {(fieldErrors.date ?? fieldErrors.time)?.[0]}
                  </p>
                ) : null}
                {!values.allDay ? (
                  <p className="text-caption text-muted-foreground">
                    Ends automatically 2 hours later.
                  </p>
                ) : null}
              </>
            ) : null}

            {state?.error ? (
              <p role="alert" className="text-small text-destructive">
                {state.error}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
