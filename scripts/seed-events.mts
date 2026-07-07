#!/usr/bin/env node
// Dev/e2e fixture data for the calendar (#10) — both tracks, all-day and
// timed events, and deliberate overlaps to exercise the layout algorithm.
// Not a user-facing creation flow; #11 owns that. Usage: `pnpm seed:events`.
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

// Local dev setups vary between `.env` and `.env.local` (see .env.example);
// load both, without overriding whichever is already set.
config({ path: ".env.local" });
config({ path: ".env" });

// Connects directly rather than importing lib/db/index.ts, which is guarded
// by the `server-only` package and throws outside Next's server runtime.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill in " +
      "your Neon connection string."
  );
}
const db = drizzle(neon(connectionString));

const { events } = await import("../lib/db/schema.ts");

function at(daysFromToday: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function dateOnly(daysFromToday: number): Date {
  const date = at(daysFromToday, 0);
  return date;
}

const fixtures = [
  // Today: an overlapping pair on the work track (exercises column-packing).
  {
    track: "work" as const,
    title: "Sprint planning",
    description: "Plan the next two-week cycle.",
    startsAt: at(0, 9),
    endsAt: at(0, 10, 30),
    allDay: false,
  },
  {
    track: "work" as const,
    title: "1:1 with manager",
    description: null,
    startsAt: at(0, 9, 45),
    endsAt: at(0, 10, 15),
    allDay: false,
  },
  {
    track: "content" as const,
    title: "Record voiceover",
    description: "For the dashboard rebuild video.",
    startsAt: at(0, 14),
    endsAt: at(0, 15, 30),
    allDay: false,
  },

  // Tomorrow: both tracks side by side, non-overlapping.
  {
    track: "work" as const,
    title: "Code review block",
    description: null,
    startsAt: at(1, 11),
    endsAt: at(1, 12),
    allDay: false,
  },
  {
    track: "content" as const,
    title: 'Edit: "Why I rebuilt my dashboard"',
    description: null,
    startsAt: at(1, 16),
    endsAt: at(1, 18),
    allDay: false,
  },

  // All-day events, one per track.
  {
    track: "work" as const,
    title: "Company all-hands",
    description: null,
    startsAt: dateOnly(2),
    endsAt: dateOnly(2),
    allDay: true,
  },
  {
    track: "content" as const,
    title: "Video publish day",
    description: null,
    startsAt: dateOnly(3),
    endsAt: dateOnly(3),
    allDay: true,
  },

  // A multi-day all-day event.
  {
    track: "work" as const,
    title: "Conference",
    description: "Out of office.",
    startsAt: dateOnly(5),
    endsAt: dateOnly(7),
    allDay: true,
  },

  // A timed event crossing midnight (clamped per day in the UI).
  {
    track: "content" as const,
    title: "Late-night stream",
    description: null,
    startsAt: at(4, 22),
    endsAt: at(5, 1),
    allDay: false,
  },

  // Last week and next week, so week/month navigation has something to show.
  {
    track: "work" as const,
    title: "Retro",
    description: null,
    startsAt: at(-7, 15),
    endsAt: at(-7, 16),
    allDay: false,
  },
  {
    track: "content" as const,
    title: "Script draft: Q3 roadmap video",
    description: null,
    startsAt: at(10, 13),
    endsAt: at(10, 14),
    allDay: false,
  },
];

async function main() {
  console.log(`Seeding ${fixtures.length} events...`);
  await db.insert(events).values(fixtures);
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
