import "server-only";
import { asc, desc, eq, lt } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  dailyLogItems,
  dailyLogs,
  type DailyLog,
  type DailyLogItem,
} from "@/lib/db/schema";
import { buildStandupView, type StandupView } from "@/lib/journal/standup";

export interface DayLog {
  /** `null` when the day has never been written to — no row is created for a read. */
  log: DailyLog | null;
  items: DailyLogItem[];
}

/** Read-only day fetch — a day with no log yet returns `log: null` and an empty item list. */
export async function getDayLog(logDate: string): Promise<DayLog> {
  const db = getDb();
  const [log] = await db
    .select()
    .from(dailyLogs)
    .where(eq(dailyLogs.logDate, logDate));
  if (!log) return { log: null, items: [] };

  const items = await db
    .select()
    .from(dailyLogItems)
    .where(eq(dailyLogItems.logId, log.id))
    .orderBy(asc(dailyLogItems.position));

  return { log, items };
}

/**
 * Lazily creates the day's log row on first write — every mutation goes
 * through this instead of assuming the row exists (see docs/journal.md).
 * `onConflictDoNothing` + a re-fetch handles the race where two writes hit
 * the same not-yet-logged day at once.
 */
export async function getOrCreateLog(logDate: string): Promise<DailyLog> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(dailyLogs)
    .where(eq(dailyLogs.logDate, logDate));
  if (existing) return existing;

  const [created] = await db
    .insert(dailyLogs)
    .values({ logDate })
    .onConflictDoNothing({ target: dailyLogs.logDate })
    .returning();
  if (created) return created;

  const [row] = await db
    .select()
    .from(dailyLogs)
    .where(eq(dailyLogs.logDate, logDate));
  return row!;
}

/** The most recent day, strictly before `beforeDate`, that has ever been logged — or `null` if none. */
export async function getMostRecentLoggedDate(
  beforeDate: string
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ logDate: dailyLogs.logDate })
    .from(dailyLogs)
    .where(lt(dailyLogs.logDate, beforeDate))
    .orderBy(desc(dailyLogs.logDate))
    .limit(1);
  return row?.logDate ?? null;
}

/** Next stable `position` for a new item on a given log, appended at the end. */
export async function nextItemPosition(logId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ position: dailyLogItems.position })
    .from(dailyLogItems)
    .where(eq(dailyLogItems.logId, logId));
  return rows.reduce((max, row) => Math.max(max, row.position), -1) + 1;
}

/**
 * "Yesterday's done + today's plan" — fetches today plus the most recent
 * previously-logged day (skipping empty gap days) and composes them via the
 * pure `buildStandupView` (see docs/journal.md).
 */
export async function getStandupView(today: string): Promise<StandupView> {
  const todayLog = await getDayLog(today);
  const mostRecentDate = await getMostRecentLoggedDate(today);
  const mostRecentLog = mostRecentDate ? await getDayLog(mostRecentDate) : null;

  return buildStandupView(
    { date: today, items: todayLog.items },
    mostRecentDate && mostRecentLog
      ? { date: mostRecentDate, items: mostRecentLog.items }
      : null
  );
}
