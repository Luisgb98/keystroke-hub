import { Briefcase, Clapperboard, Radio, type LucideIcon } from "lucide-react";

import type { TrackKind } from "@/lib/calendar/track-kind";

/**
 * Icon + label + surface classes for a track kind — the only place track
 * visuals are defined. Keyed by `TrackKind`, so a `Track` (the two-value DB
 * enum) indexes these just as well as the derived three-value kind does.
 *
 * `Radio` is the icon the app already spends on streams everywhere else — the
 * `stream` idea format (`components/content/idea-format-styles.ts`) and the
 * stream planner both use it.
 */
export const TRACK_ICON: Record<TrackKind, LucideIcon> = {
  work: Briefcase,
  content: Clapperboard,
  stream: Radio,
};

export const TRACK_LABEL: Record<TrackKind, string> = {
  work: "Work",
  content: "Content",
  stream: "Stream",
};

export const TRACK_SURFACE_CLASSES: Record<TrackKind, string> = {
  work: "border-track-work-border bg-track-work text-track-work-foreground",
  content:
    "border-track-content-border bg-track-content text-track-content-foreground",
  stream:
    "border-track-stream-border bg-track-stream text-track-stream-foreground",
};
