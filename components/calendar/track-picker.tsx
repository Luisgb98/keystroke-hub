"use client";

import { cn } from "@/lib/utils";
import type { Track } from "@/lib/calendar/types";

import { TRACK_ICON, TRACK_LABEL, TRACK_SURFACE_CLASSES } from "./track-styles";

const TRACKS: Track[] = ["work", "content"];

interface TrackPickerProps {
  value: Track | undefined;
  onChange: (track: Track) => void;
  className?: string;
}

/**
 * Segmented control with no default selection — the track choice can never
 * be ambiguous, so the caller must disable submit until `value` is set
 * rather than this component ever pre-selecting one for the user.
 */
export function TrackPicker({ value, onChange, className }: TrackPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Track"
      className={cn("grid grid-cols-2 gap-2", className)}
    >
      {TRACKS.map((track) => {
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
              "flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-all",
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
