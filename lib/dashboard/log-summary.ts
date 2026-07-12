import type { DayLog } from "@/lib/data/daily-logs";
import { moodLabel } from "@/lib/journal/mood";

export interface LogSummary {
  state: "not_started" | "in_progress";
  plannedCount: number;
  doneCount: number;
  hasRetro: boolean;
  moodLabel: string | null;
  ctaLabel: string;
  ctaHref: string;
}

/**
 * Pure summarization of a day's log for the dashboard's log-status block
 * (issue #28/#21). Rolled-over items are excluded from both counts — same
 * treatment as `buildStandupView` (`lib/journal/standup.ts`): they're
 * yesterday's business, not today's. "Started" means the log row exists
 * and carries any signal at all (a planned/done item, a retro, or a mood),
 * not just that the row was lazily created.
 */
export function buildLogSummary(dayLog: DayLog): LogSummary {
  const activeItems = dayLog.items.filter(
    (item) => item.status !== "rolled_over"
  );
  const plannedCount = activeItems.filter(
    (item) => item.status === "planned"
  ).length;
  const doneCount = activeItems.filter((item) => item.status === "done").length;
  const hasRetro = Boolean(dayLog.log?.retro);
  const mood = moodLabel(dayLog.log?.mood ?? null);
  const started =
    dayLog.log !== null &&
    (plannedCount > 0 || doneCount > 0 || hasRetro || mood !== null);

  return {
    state: started ? "in_progress" : "not_started",
    plannedCount,
    doneCount,
    hasRetro,
    moodLabel: mood,
    ctaLabel: started ? "Continue today's log" : "Start today's log",
    ctaHref: "/journal",
  };
}
