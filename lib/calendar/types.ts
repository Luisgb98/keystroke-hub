import type { IdeaStatus } from "@/lib/content/idea-status";

/**
 * The `events.track` Postgres enum: the strict two-world boundary. What an
 * event *looks like* on the calendar is a third value wider — see
 * `TrackKind` in `./track-kind.ts`.
 */
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
  /**
   * The stream session this event schedules, if any (issue #104). Non-null is
   * exactly what makes the block read as a Stream rather than as Content —
   * see `trackKindOf` in `./track-kind.ts`.
   */
  streamId: string | null;
}
