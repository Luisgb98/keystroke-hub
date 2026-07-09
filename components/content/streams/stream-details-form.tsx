"use client";

import { useActionState, useId } from "react";

import { updateStreamDetails } from "@/lib/content/stream-actions";
import type { Stream } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface StreamDetailsFormProps {
  stream: Stream;
}

/** Title + prep notes are the only fields editable after capture (mirrors `docs/content-ideas.md`'s minimal-edit precedent). */
export function StreamDetailsForm({ stream }: StreamDetailsFormProps) {
  const titleId = useId();
  const [state, formAction, pending] = useActionState(
    updateStreamDetails,
    undefined
  );
  const fieldErrors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={stream.id} />

      <div className="flex flex-col gap-2">
        <Label htmlFor={titleId}>Topic</Label>
        <Input
          id={titleId}
          name="title"
          defaultValue={stream.title}
          aria-invalid={fieldErrors.title ? true : undefined}
        />
        {fieldErrors.title ? (
          <p role="alert" className="text-small text-destructive">
            {fieldErrors.title[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stream-detail-notes">Prep notes</Label>
        <Textarea
          id="stream-detail-notes"
          name="notes"
          defaultValue={stream.notes ?? ""}
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-small text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        className="self-start"
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
