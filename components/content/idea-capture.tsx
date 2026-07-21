"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Clapperboard, Plus } from "lucide-react";
import { toast } from "sonner";

import { createIdea } from "@/lib/content/actions";
import {
  IDEA_FORMATS,
  INITIAL_IDEA_FORMAT,
  IDEA_FORMAT_LABEL,
  type IdeaFormat,
} from "@/lib/content/idea-format";
import { cn } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";

import { IDEA_FORMAT_ICON } from "./idea-format-styles";

const EMPTY_VALUES = {
  title: "",
  notes: "",
  format: INITIAL_IDEA_FORMAT as IdeaFormat,
  tags: "",
};

/**
 * Self-contained floating "New idea" button + capture dialog — no lifted
 * dialog controller, mirroring `EventChip`/`EventBlock`'s precedent in
 * `docs/calendar.md`. Title is the only required field: two taps + typing
 * captures an idea (see docs/content-ideas.md).
 */
export function IdeaCapture() {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY_VALUES);
  const [state, formAction, pending] = useActionState(createIdea, undefined);
  const [capturedTitle, setCapturedTitle] = useState("");

  // Adjusting state during render (rather than in an effect) on a `state`
  // transition — same pattern as EventEditor's `prevOpen` handling in
  // components/calendar/event-editor.tsx — avoids an extra render pass and
  // the "setState in effect" cascading-render lint rule. `capturedTitle` is
  // set here (batched with the `values` reset below) so the toast effect can
  // still read the submitted title after `values.title` clears.
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
          data-slot="idea-toast"
          className="flex items-center gap-2 rounded-lg border border-track-content-border bg-track-content px-3 py-2 text-sm text-track-content-foreground shadow-sm"
        >
          <Clapperboard aria-hidden className="size-4 shrink-0" />
          <span>
            Idea captured: <strong>{capturedTitle}</strong>
          </span>
        </div>
      ));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErrors = state?.fieldErrors ?? {};

  return (
    <>
      <Button
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.75rem)] z-30 shadow-lg md:right-6 md:bottom-6"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden />
        New idea
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form action={formAction} className="flex flex-col gap-4" noValidate>
            <input type="hidden" name="format" value={values.format} />

            <DialogHeader>
              <DialogTitle>New idea</DialogTitle>
              <DialogDescription>
                Capture it now — everything but the title can wait.
              </DialogDescription>
            </DialogHeader>

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

            <div className="flex flex-col gap-2">
              <Label>Format</Label>
              <div
                role="radiogroup"
                aria-label="Format"
                className="grid grid-cols-3 gap-2"
              >
                {IDEA_FORMATS.map((format) => {
                  const Icon = IDEA_FORMAT_ICON[format];
                  const selected = values.format === format;
                  return (
                    <button
                      key={format}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setValues((v) => ({ ...v, format }))}
                      className={cn(
                        "flex h-11 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-all",
                        selected
                          ? "border-track-content-border bg-track-content text-track-content-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <Icon aria-hidden className="size-4 shrink-0" />
                      {IDEA_FORMAT_LABEL[format]}
                    </button>
                  );
                })}
              </div>
              {fieldErrors.format ? (
                <p role="alert" className="text-small text-destructive">
                  {fieldErrors.format[0]}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="idea-notes">Notes</Label>
              <Textarea
                id="idea-notes"
                name="notes"
                value={values.notes}
                onChange={(e) =>
                  setValues((v) => ({ ...v, notes: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="idea-tags">Tags</Label>
              <Input
                id="idea-tags"
                name="tags"
                placeholder="speedrun, tutorial, glitch"
                value={values.tags}
                onChange={(e) =>
                  setValues((v) => ({ ...v, tags: e.target.value }))
                }
              />
              <p className="text-caption text-muted-foreground">
                Comma-separated.
              </p>
            </div>

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
