"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { triageEntry } from "@/lib/inbox/actions";
import type {
  TriageDestination,
  TriagePayload,
} from "@/lib/inbox/entry-schema";
import { prefillForDestination } from "@/lib/inbox/prefill";
import { cn } from "@/lib/utils";
import { TRACK_SURFACE_CLASSES } from "@/components/calendar/track-styles";
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

import { DESTINATION_META } from "./destinations";

interface TriageDialogProps {
  entryId: string;
  body: string;
  destination: TriageDestination;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the entry successfully leaves the inbox. */
  onTriaged: () => void;
}

/**
 * The destination-specific step of triage: the captured text arrives prefilled
 * into the target's fields (see docs/inbox.md), the user enriches if they want,
 * and saving converts the entry into that destination in one atomic action
 * (`triageEntry`). Not the destination's own full form — a focused subset that
 * reuses the same validation rules (see `triagePayloadSchema`).
 */
export function TriageDialog({
  entryId,
  body,
  destination,
  today,
  open,
  onOpenChange,
  onTriaged,
}: TriageDialogProps) {
  const meta = DESTINATION_META[destination];
  const Icon = meta.icon;

  const [values, setValues] = useState(() =>
    prefillForDestination(body, destination, today)
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Re-seed the prefill whenever this dialog (re)opens — the instance can be
  // reused across destinations for the same card (render-time reset, same
  // idiom as EventEditor / CaptureDialog).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setValues(prefillForDestination(body, destination, today));
      setError(null);
    }
  }

  function buildPayload(): TriagePayload {
    switch (destination) {
      case "content_idea":
        return {
          type: destination,
          title: values.title,
          notes: values.secondary,
        };
      case "improvement":
        return {
          type: destination,
          title: values.title,
          rationale: values.secondary,
        };
      case "daily_log_item":
        return { type: destination, title: values.title };
      case "meeting_note":
        return {
          type: destination,
          date: values.date,
          title: values.title,
          notes: values.secondary,
        };
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await triageEntry(entryId, buildPayload());
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(`Sent to ${meta.label}`);
      onOpenChange(false);
      onTriaged();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md border",
                  TRACK_SURFACE_CLASSES[meta.track]
                )}
              >
                <Icon aria-hidden className="size-4" />
              </span>
              <DialogTitle>{meta.label}</DialogTitle>
            </div>
            <DialogDescription>{meta.hint}.</DialogDescription>
          </DialogHeader>

          {destination === "meeting_note" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="triage-date">Date</Label>
              <Input
                id="triage-date"
                type="date"
                value={values.date}
                onChange={(e) =>
                  setValues((v) => ({ ...v, date: e.target.value }))
                }
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="triage-title">Title</Label>
            <Input
              id="triage-title"
              autoFocus
              value={values.title}
              placeholder={
                destination === "meeting_note"
                  ? "What was the meeting?"
                  : undefined
              }
              onChange={(e) =>
                setValues((v) => ({ ...v, title: e.target.value }))
              }
            />
          </div>

          {destination !== "daily_log_item" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="triage-secondary">
                {destination === "content_idea"
                  ? "Notes"
                  : destination === "improvement"
                    ? "Rationale"
                    : "Notes"}
              </Label>
              <Textarea
                id="triage-secondary"
                rows={4}
                value={values.secondary}
                onChange={(e) =>
                  setValues((v) => ({ ...v, secondary: e.target.value }))
                }
              />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-small text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : `Send to ${meta.label}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
