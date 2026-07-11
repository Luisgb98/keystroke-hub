"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveWeeklyRating } from "@/lib/journal/actions";
import { cn } from "@/lib/utils";

interface RatingStep {
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
}

/**
 * Word anchors, deliberately different vocabulary from the daily mood
 * picker's energy scale (`MOOD_STEPS` in `mood-picker.tsx`) — this reads as
 * the week's overall texture, not an average of moods (see docs/journal.md).
 */
const RATING_STEPS: RatingStep[] = [
  { value: 1, label: "Rough" },
  { value: 2, label: "Bumpy" },
  { value: 3, label: "Steady" },
  { value: 4, label: "Strong" },
  { value: 5, label: "Great" },
];

interface WeekRatingPickerProps {
  weekStart: string;
  rating: number | null;
}

/** 5-step non-punitive weekly rating; tapping the selected step again clears it — structured like `MoodPicker` (see docs/journal.md). */
export function WeekRatingPicker({ weekStart, rating }: WeekRatingPickerProps) {
  const [value, setValue] = useState(rating);
  const [pending, startTransition] = useTransition();

  function handleSelect(step: number) {
    const nextValue = value === step ? null : step;
    setValue(nextValue);
    startTransition(async () => {
      const result = await saveWeeklyRating(weekStart, nextValue);
      if (result.error) {
        toast.error(result.error);
        setValue(rating);
      }
    });
  }

  return (
    <div
      data-slot="week-rating-picker"
      role="radiogroup"
      aria-label="Week rating"
      className="flex items-center justify-between gap-1"
    >
      {RATING_STEPS.map((step) => {
        const selected = value === step.value;
        return (
          <button
            key={step.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={step.label}
            disabled={pending}
            onClick={() => handleSelect(step.value)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-lg border border-border px-1 py-2.5 text-caption transition-colors disabled:opacity-50",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {step.label}
          </button>
        );
      })}
    </div>
  );
}
