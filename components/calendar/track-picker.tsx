"use client";

import { cn } from "@/lib/utils";
import { TRACK_KINDS, type TrackKind } from "@/lib/calendar/track-kind";

import { TRACK_ICON, TRACK_LABEL, TRACK_SURFACE_CLASSES } from "./track-styles";

interface TrackPickerProps {
  value: TrackKind | undefined;
  onChange: (track: TrackKind) => void;
  className?: string;
}

/**
 * Segmented control with no default selection — the track choice can never
 * be ambiguous, so the caller must disable submit until `value` is set
 * rather than this component ever pre-selecting one for the user.
 *
 * Three columns since #104: Work, Content and Stream. The label wraps under
 * the icon on a phone rather than being dropped — color is never the only
 * signal, so every option keeps both.
 */
export function TrackPicker({ value, onChange, className }: TrackPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Track"
      className={cn("grid grid-cols-3 gap-2", className)}
    >
      {TRACK_KINDS.map((track) => {
        const Icon = TRACK_ICON[track];
        const selected = value === track;

        return (
          <button
            key={track}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(track)}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-caption font-medium transition-all sm:flex-row sm:gap-2 sm:text-sm",
              selected
                ? TRACK_SURFACE_CLASSES[track]
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            {TRACK_LABEL[track]}
          </button>
        );
      })}
    </div>
  );
}
