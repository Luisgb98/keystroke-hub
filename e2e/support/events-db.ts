import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, like } from "drizzle-orm";

import { events } from "../../lib/db/schema";
import type { Track } from "../../lib/calendar/types";

/** Prefix isolates e2e fixture rows so cleanup can't touch real/dev data. */
const TITLE_PREFIX = "[e2e]";

function getTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — calendar e2e tests require it.");
  }
  return drizzle(neon(connectionString));
}

export const E2E_WORK_EVENT_TITLE = `${TITLE_PREFIX} Work meeting`;
export const E2E_CONTENT_EVENT_TITLE = `${TITLE_PREFIX} Content recording`;
export const E2E_ALL_DAY_EVENT_TITLE = `${TITLE_PREFIX} All-day work event`;

/** Inserts a small, deterministic fixture set anchored on `today`, for calendar e2e assertions. */
export async function seedTestEvents(today: Date): Promise<void> {
  const db = getTestDb();
  const at = (hour: number, minute = 0) => {
    const date = new Date(today);
    date.setHours(hour, minute, 0, 0);
    return date;
  };
  const dateOnly = () => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  await db.insert(events).values([
    {
      track: "work",
      title: E2E_WORK_EVENT_TITLE,
      startsAt: at(9),
      endsAt: at(10),
      allDay: false,
    },
    {
      track: "content",
      title: E2E_CONTENT_EVENT_TITLE,
      startsAt: at(14),
      endsAt: at(15),
      allDay: false,
    },
    {
      track: "work",
      title: E2E_ALL_DAY_EVENT_TITLE,
      startsAt: dateOnly(),
      endsAt: dateOnly(),
      allDay: true,
    },
  ]);
}

/** Removes every fixture row this suite may have inserted. */
export async function clearTestEvents(): Promise<void> {
  await clearEventsWithPrefix(TITLE_PREFIX);
}

/**
 * Removes rows by a title prefix other than the shared `[e2e]` one — for
 * specs (e.g. `event-management.spec.ts`) that create/delete events through
 * the UI rather than seeding fixed rows, and need cleanup that can't
 * accidentally sweep up another spec file's concurrently-running fixtures
 * (Playwright runs spec files in parallel workers against the same dev DB).
 */
export async function clearEventsWithPrefix(prefix: string): Promise<void> {
  const db = getTestDb();
  await db.delete(events).where(like(events.title, `${prefix}%`));
}

/** Inserts a single event with fully deterministic bounds — for tests (e.g. drag-reschedule) that need to assert an exact px-to-time conversion. */
export async function insertTestEvent(fixture: {
  title: string;
  track: Track;
  startsAt: Date;
  endsAt: Date;
  allDay?: boolean;
}): Promise<void> {
  const db = getTestDb();
  await db.insert(events).values({
    track: fixture.track,
    title: fixture.title,
    startsAt: fixture.startsAt,
    endsAt: fixture.endsAt,
    allDay: fixture.allDay ?? false,
  });
}

/** Reads back an event's persisted bounds by exact title, for post-drag assertions. */
export async function getTestEventTimes(
  title: string
): Promise<{ startsAt: Date; endsAt: Date } | undefined> {
  const db = getTestDb();
  const [row] = await db
    .select({ startsAt: events.startsAt, endsAt: events.endsAt })
    .from(events)
    .where(eq(events.title, title));
  return row;
}

/** Deletes a single event by exact title — used to simulate a concurrent deletion mid-drag. */
export async function deleteTestEventByTitle(title: string): Promise<void> {
  const db = getTestDb();
  await db.delete(events).where(eq(events.title, title));
}
