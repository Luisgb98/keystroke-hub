"use client";

import { useActionState, useId, useState } from "react";

import { updateStreamDetails } from "@/lib/content/stream-actions";
import type { Stream } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface StreamDetailsFormProps {
  stream: Stream;
}

interface DetailValues {
  title: string;
  notes: string;
}

function savedValuesOf(stream: Stream): DetailValues {
  return { title: stream.title, notes: stream.notes ?? "" };
}

function sameValues(a: DetailValues, b: DetailValues): boolean {
  return a.title === b.title && a.notes === b.notes;
}

/** Title + prep notes are the only fields editable after capture (mirrors `docs/content-ideas.md`'s minimal-edit precedent). */
export function StreamDetailsForm({ stream }: StreamDetailsFormProps) {
  const titleId = useId();
  const [state, formAction, pending] = useActionState(
    updateStreamDetails,
    undefined
  );
  const fieldErrors = state?.fieldErrors ?? {};

  // Controlled, never `defaultValue`: saving revalidates this route, so the
  // server hands back a fresh `stream` on the very next render. An uncontrolled
  // Base UI field sees its `defaultValue` change after init — which it warns
  // about — and then keeps painting the *old* string, so the input silently
  // disagrees with the row that was just written (#102).
  const saved = savedValuesOf(stream);
  const [lastSaved, setLastSaved] = useState(saved);
  const [values, setValues] = useState(saved);

  // Adjusting own state during render — the legal form of the idiom (see
  // docs/design-system.md). Compared field-by-field because `saved` is a fresh
  // object every render. A revalidation that doesn't touch these columns (a
  // checklist toggle also refreshes this page) leaves both alone, so in-progress
  // typing survives it.
  if (!sameValues(lastSaved, saved)) {
    setLastSaved(saved);
    setValues(saved);
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={stream.id} />

      <div className="flex flex-col gap-2">
        <Label htmlFor={titleId}>Topic</Label>
        <Input
          id={titleId}
          name="title"
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
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
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
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
