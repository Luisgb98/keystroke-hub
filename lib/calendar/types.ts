import type { IdeaStatus } from "@/lib/content/idea-status";

export type Track = "work" | "content";

export type CalendarView = "day" | "week" | "month";

export const CALENDAR_VIEWS: CalendarView[] = ["day", "week", "month"];

/** A linked idea, as summarized for `EventEditor`'s "Linked content" section (issue #18) — see docs/content-links.md. */
export interface LinkedIdeaSummary {
  id: string;
  title: string;
  status: IdeaStatus;
  hasScript: boolean;
}

export interface CalendarEvent {
  id: string;
  track: Track;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  /** Set when Google Calendar sync (issue #12) last resolved a conflicting edit on this event — see docs/google-sync.md. */
  conflictNote: string | null;
  /** Always empty on work-track events — the concept doesn't exist there (issue #18). */
  linkedIdeas: LinkedIdeaSummary[];
}
