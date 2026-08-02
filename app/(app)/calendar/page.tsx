import type { Metadata } from "next";

import { CalendarHeader } from "@/components/calendar/calendar-header";
import { DayView } from "@/components/calendar/day-view";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import type { SyncStatusSummary } from "@/components/calendar/sync-status-row";
import { getEventsInRange } from "@/lib/data/events";
import {
  getMonthGridDays,
  getVisibleRange,
  getWeekDays,
  parseDateParam,
  parseViewParam,
} from "@/lib/calendar/range";
import type { CalendarEvent } from "@/lib/calendar/types";
import { getDb } from "@/lib/db";
import { calendarConnections } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Calendar",
};

interface CalendarPageProps {
  searchParams: Promise<{ view?: string; date?: string }>;
}

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const params = await searchParams;
  const view = parseViewParam(params.view);
  const date = parseDateParam(params.date);
  const now = new Date();

  const { from, to } = getVisibleRange(view, date);
  // The calendar shell (header, view switcher) should render even if the
  // database is unreachable — e.g. CI's e2e job has no DATABASE_URL (see
  // docs/database.md) but still exercises this page via shell-navigation.
  let events: CalendarEvent[] = [];
  try {
    events = await getEventsInRange(from, to);
  } catch (error) {
    console.error("Failed to load calendar events:", error);
  }

  // Same resilience contract as above — the sync indicator is ambient and
  // must never break the calendar page itself (docs/google-sync.md).
  let syncStatus: SyncStatusSummary[] = [];
  try {
    const connections = await getDb().select().from(calendarConnections);
    syncStatus = connections.map((connection) => ({
      track: connection.track,
      status: connection.status,
      lastSyncedAt: connection.lastSyncedAt,
    }));
  } catch (error) {
    console.error("Failed to load calendar connection status:", error);
  }

  // The one page that never lets `<main>` scroll: the heading and header stay
  // pinned and each view scrolls inside its own grid instead (issue #87, see
  // docs/calendar.md#scroll-contract). `min-h-0` + `overflow-hidden` are what
  // make this a hard cap — without them flexbox's `min-height: auto` lets the
  // column stretch to its content and the page scrolls again.
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 py-6 sm:px-10 sm:py-8">
      <h1 className="font-heading text-h1 font-semibold">Calendar</h1>
      <CalendarHeader view={view} date={date} syncStatus={syncStatus} />
      {view === "day" && <DayView day={date} events={events} now={now} />}
      {view === "week" && (
        <WeekView days={getWeekDays(date)} events={events} now={now} />
      )}
      {view === "month" && (
        <MonthView
          days={getMonthGridDays(date)}
          anchorMonth={date}
          events={events}
          now={now}
        />
      )}
    </div>
  );
}
