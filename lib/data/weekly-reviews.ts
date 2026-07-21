import "server-only";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  dailyLogItems,
  dailyLogs,
  weeklyReviews,
  type DailyLog,
  type DailyLogItem,
  type WeeklyReview,
} from "@/lib/db/schema";
import { buildWeekSummary, type WeekSummary } from "@/lib/journal/week-summary";
import { weekDayParams } from "@/lib/journal/week-dates";

export interface WeekDayLog {
  date: string;
  log: DailyLog | null;
  items: DailyLogItem[];
}

/** Read-only week fetch — one range query for the week's logs, one for their items (see docs/journal.md). */
export async function getWeekLogs(weekStart: string): Promise<WeekDayLog[]> {
  const db = getDb();
  const days = weekDayParams(weekStart);
  const weekEnd = days[days.length - 1]!;

  const logs = await db
    .select()
    .from(dailyLogs)
    .where(
      and(gte(dailyLogs.logDate, weekStart), lte(dailyLogs.logDate, weekEnd))
    );

  const logIds = logs.map((log) => log.id);
  const items = logIds.length
    ? await db
        .select()
        .from(dailyLogItems)
        .where(inArray(dailyLogItems.logId, logIds))
    : [];

  const logsByDate = new Map(logs.map((log) => [log.logDate, log]));
  const itemsByLogId = new Map<string, DailyLogItem[]>();
  for (const item of items) {
    const list = itemsByLogId.get(item.logId) ?? [];
    list.push(item);
    itemsByLogId.set(item.logId, list);
  }

  return days.map((date) => {
    const log = logsByDate.get(date) ?? null;
    return {
      date,
      log,
      items: log ? (itemsByLogId.get(log.id) ?? []) : [],
    };
  });
}

/** Read-only — a week with no highlights yet returns `null`. */
export async function getWeeklyReview(
  weekStart: string
): Promise<WeeklyReview | null> {
  const db = getDb();
  const [review] = await db
    .select()
    .from(weeklyReviews)
    .where(eq(weeklyReviews.weekStart, weekStart));
  return review ?? null;
}

/**
 * Lazily creates the week's review row on first highlights write —
 * `onConflictDoNothing` + a re-fetch handles the race where two writes hit
 * the same not-yet-reviewed week at once (same precedent as `getOrCreateLog`
 * in `lib/data/daily-logs.ts`).
 */
export async function getOrCreateWeeklyReview(
  weekStart: string
): Promise<WeeklyReview> {
  const existing = await getWeeklyReview(weekStart);
  if (existing) return existing;

  const db = getDb();
  const [created] = await db
    .insert(weeklyReviews)
    .values({ weekStart })
    .onConflictDoNothing({ target: weeklyReviews.weekStart })
    .returning();
  if (created) return created;

  const [row] = await db
    .select()
    .from(weeklyReviews)
    .where(eq(weeklyReviews.weekStart, weekStart));
  return row!;
}

/** Fetches a week's logs + review and composes them via the pure `buildWeekSummary`. */
export async function getWeekSummary(weekStart: string): Promise<WeekSummary> {
  const [days, review] = await Promise.all([
    getWeekLogs(weekStart),
    getWeeklyReview(weekStart),
  ]);
  return buildWeekSummary(weekStart, days, review);
}

/**
 * The most recent `limit` reviewed weeks at or before `throughWeekStart`, for
 * the assessment trend view. Only returns weeks that actually have a
 * `weekly_reviews` row — unassessed weeks in the trend's fixed date range are
 * gaps the caller fills in, not rows this query needs to know about.
 */
export async function getRecentWeeklyReviews(
  throughWeekStart: string,
  limit: number
): Promise<WeeklyReview[]> {
  const db = getDb();
  return db
    .select()
    .from(weeklyReviews)
    .where(lte(weeklyReviews.weekStart, throughWeekStart))
    .orderBy(desc(weeklyReviews.weekStart))
    .limit(limit);
}
