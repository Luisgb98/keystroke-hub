import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, gte, like, lte } from "drizzle-orm";

import { dailyLogItems, dailyLogs } from "../../lib/db/schema";

function getTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — journal e2e tests require it.");
  }
  return drizzle(neon(connectionString));
}

/**
 * Removes every daily log (and its items, cascade) within an inclusive
 * `yyyy-MM-dd` date range — safe only for the dedicated far-future test
 * window this suite writes to, never for real (today-adjacent) dates.
 */
export async function clearTestDailyLogs(
  fromDate: string,
  toDate: string
): Promise<void> {
  const db = getTestDb();
  await db
    .delete(dailyLogs)
    .where(
      and(gte(dailyLogs.logDate, fromDate), lte(dailyLogs.logDate, toDate))
    );
}

/**
 * Removes only items matching a title prefix, leaving the day's log row
 * (and its retro/mood) untouched — for the standup suite, which must write
 * to the real "today"/"yesterday" and can't risk clobbering a developer's
 * actual retro/mood for those days.
 */
export async function clearTestDailyLogItemsByTitle(
  prefix: string
): Promise<void> {
  const db = getTestDb();
  await db.delete(dailyLogItems).where(like(dailyLogItems.title, `${prefix}%`));
}
