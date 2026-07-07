import type { Metadata } from "next";

import { CalendarConnectionCard } from "@/components/settings/calendar-connection-card";
import { CalendarPicker } from "@/components/settings/calendar-picker";
import type { Track } from "@/lib/calendar/types";
import { getDb } from "@/lib/db";
import { calendarConnections, type CalendarConnection } from "@/lib/db/schema";
import { getPendingConnectionView } from "@/lib/sync/actions";

export const metadata: Metadata = {
  title: "Calendars",
};

const TRACKS: Track[] = ["work", "content"];

const ERROR_MESSAGES: Record<string, string> = {
  google_auth_failed: "Google sign-in failed — try connecting again.",
  invalid_state: "That connection link expired — try connecting again.",
  no_refresh_token:
    "Google didn't grant offline access — try connecting again and approve access when prompted.",
};

interface CalendarsSettingsPageProps {
  searchParams: Promise<{ error?: string; connect?: string }>;
}

export default async function CalendarsSettingsPage({
  searchParams,
}: CalendarsSettingsPageProps) {
  const params = await searchParams;

  // Same resilience contract as the calendar page (docs/calendar.md) — the
  // shell renders even if the database is unreachable, e.g. in CI's e2e job.
  let connections: CalendarConnection[] = [];
  try {
    connections = await getDb().select().from(calendarConnections);
  } catch (error) {
    console.error("Failed to load calendar connections:", error);
  }
  const connectionsByTrack = new Map(connections.map((c) => [c.track, c]));

  const pending =
    params.connect === "pending" ? await getPendingConnectionView() : null;

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-10 sm:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-h1 font-semibold">Calendars</h1>
        <p className="text-small text-muted-foreground">
          Connect one Google Calendar per track. Events sync both ways —
          conflicts are resolved by latest edit wins.
        </p>
      </div>

      {params.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-small text-destructive"
        >
          {ERROR_MESSAGES[params.error] ??
            "Something went wrong connecting Google Calendar."}
        </p>
      ) : null}

      {pending ? (
        <CalendarPicker
          track={pending.track}
          googleAccountEmail={pending.googleAccountEmail}
          calendars={pending.calendars}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {TRACKS.map((track) => (
          <CalendarConnectionCard
            key={track}
            track={track}
            connection={connectionsByTrack.get(track) ?? null}
          />
        ))}
      </div>
    </div>
  );
}
