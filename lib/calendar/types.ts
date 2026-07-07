export type Track = "work" | "content";

export type CalendarView = "day" | "week" | "month";

export const CALENDAR_VIEWS: CalendarView[] = ["day", "week", "month"];

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
}
