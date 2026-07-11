import type { DailyLogItem } from "@/lib/db/schema";

export interface StandupItemView {
  id: string;
  title: string;
  status: DailyLogItem["status"];
}

export interface StandupSection {
  date: string;
  items: StandupItemView[];
  isEmpty: boolean;
}

export interface StandupView {
  /** `null` only when no day before `today` has ever been logged (day one of using the journal). */
  yesterday: StandupSection | null;
  today: StandupSection;
}

function toItemView(item: DailyLogItem): StandupItemView {
  return { id: item.id, title: item.title, status: item.status };
}

/**
 * Composes the standup view from already-fetched data — split out so the
 * "yesterday" gap-day rule and the empty-state nudge are unit-testable
 * without a database connection (mirrors `bucketStreams` in
 * `lib/data/streams.ts`). See docs/journal.md.
 *
 * "Yesterday" shows only what got *done* (what to report); "today" shows
 * the current plan (`planned` + ad-hoc `done`, excluding items already
 * rolled forward off today's log). `mostRecentPastLog` is the most recent
 * day *before* `today` that has ever been logged — literal yesterday if it
 * has one, otherwise reaching back across empty gap days (weekends, days
 * off) — or `null` if no such day exists yet.
 */
export function buildStandupView(
  today: { date: string; items: DailyLogItem[] },
  mostRecentPastLog: { date: string; items: DailyLogItem[] } | null
): StandupView {
  const yesterday = mostRecentPastLog
    ? (() => {
        const done = mostRecentPastLog.items
          .filter((item) => item.status === "done")
          .map(toItemView);
        return {
          date: mostRecentPastLog.date,
          items: done,
          isEmpty: done.length === 0,
        };
      })()
    : null;

  const todayItems = today.items
    .filter((item) => item.status !== "rolled_over")
    .map(toItemView);

  return {
    yesterday,
    today: {
      date: today.date,
      items: todayItems,
      isEmpty: todayItems.length === 0,
    },
  };
}
