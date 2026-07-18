"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { captureEntry } from "@/lib/inbox/actions";
import { MAX_BODY_LENGTH } from "@/lib/inbox/entry-schema";
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
import { Textarea } from "@/components/ui/textarea";

interface CaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The counter starts nudging once the body crosses this fraction of the cap. */
const COUNTER_VISIBLE_FROM = 0.9 * MAX_BODY_LENGTH;

/**
 * The signature quick-capture surface: an autofocused textarea and a Save
 * button, nothing else. Deferring classification is the whole point (see
 * docs/inbox.md), so there's no category, title, or required choice — tap to
 * open, type, ⌘/Ctrl+Enter (or Save) to file it. Rendered once, globally, by
 * `InboxCaptureProvider` so it's reachable from every screen.
 */
export function CaptureDialog({ open, onOpenChange }: CaptureDialogProps) {
  const labelId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [body, setBody] = useState("");
  const [state, formAction, pending] = useActionState(captureEntry, undefined);

  // Clear the field each time the dialog re-opens (the instance stays mounted
  // across opens) — a render-time reset, not an effect, mirroring EventEditor.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setBody("");
  }

  useEffect(() => {
    if (state?.success) {
      toast.success("Captured");
      // No local reset here — closing unmounts the field's value from view and
      // the render-time reset above clears it on the next open (keeps this
      // effect a pure "notify external systems" step, per the lint rule).
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  const remaining = MAX_BODY_LENGTH - body.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-labelledby={labelId}>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle id={labelId}>Capture a thought</DialogTitle>
            <DialogDescription>
              Get it out of your head now — triage it later from the inbox.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Textarea
              name="body"
              autoFocus
              rows={4}
              maxLength={MAX_BODY_LENGTH}
              aria-label="What's on your mind?"
              placeholder="What's on your mind?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-invalid={state?.fieldError ? true : undefined}
            />
            <div className="flex min-h-4 items-center justify-between">
              {state?.fieldError ? (
                <p role="alert" className="text-caption text-destructive">
                  {state.fieldError}
                </p>
              ) : (
                <span />
              )}
              {body.length >= COUNTER_VISIBLE_FROM ? (
                <span
                  className={cn(
                    "text-caption text-muted-foreground tabular-nums",
                    remaining < 0 && "text-destructive"
                  )}
                >
                  {remaining}
                </span>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Capture"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
