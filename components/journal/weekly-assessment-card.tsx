"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { saveAssessmentNote } from "@/lib/journal/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { WeekRatingPicker } from "./week-rating-picker";

const AUTOSAVE_DELAY_MS = 800;

type AssessmentField = "wentWell" | "drainedMe" | "changeNext";

type SaveStatus = "idle" | "saving" | "saved";

interface PromptFieldProps {
  weekStart: string;
  field: AssessmentField;
  fieldId: string;
  label: string;
  placeholder: string;
  value: string;
}

/** One reflection prompt with debounced autosave — mirrors `RetroCard` (see docs/journal.md). */
function PromptField({
  weekStart,
  field,
  fieldId,
  label,
  placeholder,
  value: initialValue,
}: PromptFieldProps) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const savedValueRef = useRef(initialValue);

  useEffect(() => {
    if (value === savedValueRef.current) return;

    setStatus("saving");
    const timeout = setTimeout(async () => {
      const result = await saveAssessmentNote(weekStart, field, value);
      if (result.error) {
        toast.error(result.error);
        setStatus("idle");
        return;
      }
      savedValueRef.current = value;
      setStatus("saved");
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [value, weekStart, field]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={fieldId}>{label}</Label>
        <span className="text-caption text-muted-foreground" aria-live="polite">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
        </span>
      </div>
      <Textarea
        id={fieldId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

interface WeeklyAssessmentCardProps {
  weekStart: string;
  rating: number | null;
  wentWell: string;
  drainedMe: string;
  changeNext: string;
}

/**
 * The week's non-punitive self-check-in: a 5-step rating plus three
 * optional reflection prompts, all autosaved (see docs/journal.md). Deliberately
 * excluded from the "Copy as Markdown" export — this is self-reflection, not
 * standup material.
 */
export function WeeklyAssessmentCard({
  weekStart,
  rating,
  wentWell,
  drainedMe,
  changeNext,
}: WeeklyAssessmentCardProps) {
  return (
    <Card data-slot="weekly-assessment-card">
      <CardHeader>
        <CardTitle>How was the week?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <WeekRatingPicker weekStart={weekStart} rating={rating} />
        <PromptField
          weekStart={weekStart}
          field="wentWell"
          fieldId="assessment-went-well"
          label="What went well?"
          placeholder="A win, big or small…"
          value={wentWell}
        />
        <PromptField
          weekStart={weekStart}
          field="drainedMe"
          fieldId="assessment-drained-me"
          label="What drained you?"
          placeholder="Something that took more out of you than expected…"
          value={drainedMe}
        />
        <PromptField
          weekStart={weekStart}
          field="changeNext"
          fieldId="assessment-change-next"
          label="One thing to change next week"
          placeholder="A small adjustment, not a resolution…"
          value={changeNext}
        />
      </CardContent>
    </Card>
  );
}
