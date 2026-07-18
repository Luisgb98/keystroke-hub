import {
  Lightbulb,
  ListChecks,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Track } from "@/lib/calendar/types";
import type { TriageDestination } from "@/lib/inbox/entry-schema";

interface DestinationMeta {
  label: string;
  /** Short helper shown under the option / dialog title. */
  hint: string;
  icon: LucideIcon;
  /**
   * Which track's colour the option carries. An idea lives in the content
   * world; improvements, daily-log items and meeting notes are all work-track
   * (see the icon + label + colour rule in docs/design-system.md).
   */
  track: Track;
}

export const DESTINATION_META: Record<TriageDestination, DestinationMeta> = {
  content_idea: {
    label: "Content idea",
    hint: "Add to the ideas backlog",
    icon: Lightbulb,
    track: "content",
  },
  improvement: {
    label: "Improvement",
    hint: "Add to the improvements backlog",
    icon: Sparkles,
    track: "work",
  },
  daily_log_item: {
    label: "Today's log",
    hint: "Plan it on today's daily log",
    icon: ListChecks,
    track: "work",
  },
  meeting_note: {
    label: "Meeting note",
    hint: "Start a meeting note from this",
    icon: Users,
    track: "work",
  },
};
