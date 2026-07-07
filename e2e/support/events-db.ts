import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { like } from "drizzle-orm";

import { events } from "../../lib/db/schema";

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
  const db = getTestDb();
  await db.delete(events).where(like(events.title, `${TITLE_PREFIX}%`));
}
