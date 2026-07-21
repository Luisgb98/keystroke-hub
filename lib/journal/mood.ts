/**
 * Text labels for the daily log's 5-step mood scale (see `MOOD_STEPS` in
 * `components/journal/mood-picker.tsx`). Kept as a separate, icon-free
 * module so non-UI code (the weekly summary's Markdown formatter) can read
 * a mood label without pulling a `"use client"` component into a server/
 * pure-function import graph.
 */
const MOOD_LABELS: Record<number, string> = {
  1: "Drained",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Energized",
};

export function moodLabel(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return MOOD_LABELS[value] ?? null;
}
