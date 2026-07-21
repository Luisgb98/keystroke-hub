import { Briefcase, Clapperboard, type LucideIcon } from "lucide-react";

import type { Track } from "@/lib/calendar/types";

/** Icon + label + surface classes for a track — the only place track visuals are defined. */
export const TRACK_ICON: Record<Track, LucideIcon> = {
  work: Briefcase,
  content: Clapperboard,
};

export const TRACK_LABEL: Record<Track, string> = {
  work: "Work",
  content: "Content",
};

export const TRACK_SURFACE_CLASSES: Record<Track, string> = {
  work: "border-track-work-border bg-track-work text-track-work-foreground",
  content:
    "border-track-content-border bg-track-content text-track-content-foreground",
};
