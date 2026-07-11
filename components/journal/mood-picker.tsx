"use client";

import { useState, useTransition } from "react";
import {
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { saveMood } from "@/lib/journal/actions";
import { cn } from "@/lib/utils";

interface MoodStep {
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
  icon: LucideIcon;
}

/** Icon + label each — color is never the only signal (see docs/design-system.md). */
const MOOD_STEPS: MoodStep[] = [
  { value: 1, label: "Drained", icon: BatteryWarning },
  { value: 2, label: "Low", icon: BatteryLow },
  { value: 3, label: "Okay", icon: BatteryMedium },
  { value: 4, label: "Good", icon: BatteryFull },
  { value: 5, label: "Energized", icon: BatteryCharging },
];

interface MoodPickerProps {
  logDate: string;
  mood: number | null;
}

/** 5-step end-of-day energy/mood marker; tapping the selected step again clears it (see docs/journal.md). */
export function MoodPicker({ logDate, mood }: MoodPickerProps) {
  const [value, setValue] = useState(mood);
  const [pending, startTransition] = useTransition();

  function handleSelect(step: number) {
    const nextValue = value === step ? null : step;
    setValue(nextValue);
    startTransition(async () => {
      const result = await saveMood(logDate, nextValue);
      if (result.error) {
        toast.error(result.error);
        setValue(mood);
      }
    });
  }

  return (
    <div
      data-slot="mood-picker"
      role="radiogroup"
      aria-label="Mood"
      className="flex items-center justify-between gap-1"
    >
      {MOOD_STEPS.map((step) => {
        const Icon = step.icon;
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
              "flex flex-1 flex-col items-center gap-1 rounded-lg border border-border px-1 py-2 text-caption transition-colors disabled:opacity-50",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon aria-hidden className="size-5" />
            {step.label}
          </button>
        );
      })}
    </div>
  );
}
