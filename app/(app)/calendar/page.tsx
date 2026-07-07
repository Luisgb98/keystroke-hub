import type { Metadata } from "next";

import { CalendarHeader } from "@/components/calendar/calendar-header";
import { DayView } from "@/components/calendar/day-view";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { getEventsInRange } from "@/lib/data/events";
import {
  getMonthGridDays,
  getVisibleRange,
  getWeekDays,
  parseDateParam,
  parseViewParam,
} from "@/lib/calendar/range";
import type { CalendarEvent } from "@/lib/calendar/types";

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

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-10 sm:py-8">
      <h1 className="font-heading text-h1 font-semibold">Calendar</h1>
      <CalendarHeader view={view} date={date} />
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
