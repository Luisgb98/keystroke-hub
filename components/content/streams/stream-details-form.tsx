"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  updateStreamDetails,
  type StreamActionState,
} from "@/lib/content/stream-actions";
import type { Stream } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface StreamDetailsFormProps {
  stream: Stream;
  /** True once the linked event's start time has passed — promotes the retro section (see docs/content-streams.md). */
  isPast: boolean;
  /**
   * The sections that sit between the prep notes and the retro — "Scheduled"
   * and the pre-stream checklist. They're passed as children rather than left as
   * siblings on the page so this component can own every text field on the page
   * while keeping the original reading order.
   */
  children: React.ReactNode;
}

interface DetailValues {
  title: string;
  notes: string;
  retroNotes: string;
}

function savedValuesOf(stream: Stream): DetailValues {
  return {
    title: stream.title,
    notes: stream.notes ?? "",
    retroNotes: stream.retroNotes ?? "",
  };
}

function sameValues(a: DetailValues, b: DetailValues): boolean {
  return (
    a.title === b.title && a.notes === b.notes && a.retroNotes === b.retroNotes
  );
}

/**
 * Every editable field on the stream detail page, behind one Save.
 *
 * Two Save buttons on one page (topic/prep notes, then the retro) made it
 * ambiguous which one committed what, so #102 collapsed them into a single
 * button that writes all three fields in one action. It stays disabled until
 * something differs from what's stored, so the button itself answers "is there
 * anything unsaved here?".
 */
export function StreamDetailsForm({
  stream,
  isPast,
  children,
}: StreamDetailsFormProps) {
  const titleId = useId();
  const [state, setState] = useState<StreamActionState | undefined>(undefined);
  const [pending, startTransition] = useTransition();
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
  // checklist toggle also refreshes this page) leaves both alone, so
  // in-progress typing survives it.
  if (!sameValues(lastSaved, saved)) {
    setLastSaved(saved);
    setValues(saved);
  }

  const dirty = !sameValues(values, lastSaved);

  function handleSave() {
    if (!dirty) return;
    const submitted = values;
    startTransition(async () => {
      const result = await updateStreamDetails({ id: stream.id, ...submitted });
      setState(result);
      if (!result.success) {
        if (result.error && !result.fieldErrors) toast.error(result.error);
        return;
      }
      // Baselined against what was sent, not against the props: the write has
      // landed but `revalidatePath`'s refresh hasn't been applied yet, so
      // waiting for new props would leave the button falsely enabled until it
      // arrives.
      setLastSaved(submitted);
      toast.success("Saved");
    });
  }

  return (
    <>
      <div data-slot="stream-details" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={titleId}>Topic</Label>
          <Input
            id={titleId}
            value={values.title}
            onChange={(e) =>
              setValues((v) => ({ ...v, title: e.target.value }))
            }
            onKeyDown={(e) => {
              // Enter commits from the single-line field, matching the
              // checklist's add-item input.
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
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
            value={values.notes}
            onChange={(e) =>
              setValues((v) => ({ ...v, notes: e.target.value }))
            }
            aria-invalid={fieldErrors.notes ? true : undefined}
          />
          {fieldErrors.notes ? (
            <p role="alert" className="text-small text-destructive">
              {fieldErrors.notes[0]}
            </p>
          ) : null}
        </div>
      </div>

      {children}

      <section
        data-slot="stream-retro-notes"
        className={
          isPast
            ? "flex flex-col gap-2 rounded-lg border border-track-content-border bg-track-content/40 p-3"
            : "flex flex-col gap-2"
        }
      >
        <h2 className="text-small font-semibold">Post-stream notes</h2>
        <Label htmlFor="stream-retro-notes-field">How did it go?</Label>
        <Textarea
          id="stream-retro-notes-field"
          value={values.retroNotes}
          onChange={(e) =>
            setValues((v) => ({ ...v, retroNotes: e.target.value }))
          }
          placeholder="Quick notes for next time…"
          aria-invalid={fieldErrors.retroNotes ? true : undefined}
        />
        {fieldErrors.retroNotes ? (
          <p role="alert" className="text-small text-destructive">
            {fieldErrors.retroNotes[0]}
          </p>
        ) : null}
      </section>

      <div className="flex flex-col gap-2">
        {state?.error ? (
          <p role="alert" className="text-small text-destructive">
            {state.error}
          </p>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={pending || !dirty}
          className="self-start"
          onClick={handleSave}
        >
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </>
  );
}
