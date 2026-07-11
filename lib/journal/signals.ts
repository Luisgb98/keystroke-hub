import type {
  CarriedOverItem,
  WeekDayInput,
  WeekDaySummary,
} from "./week-summary";

/**
 * Neutral, derived-only context for the weekly self-assessment — never
 * stored, always recomputed from the same week data the summary already
 * fetched (see docs/journal.md). No thresholds, no red/green judgment: the
 * numbers are handed to `weekSignalSentences` as plain observations.
 */
export interface WeekSignals {
  weekdaysLogged: number;
  weekdayCount: number;
  doneCount: number;
  /** `doneCount` + `carriedOverCount` — everything tracked this week, done or still open. */
  trackedCount: number;
  carriedOverCount: number;
}

/** Mon–Fri — mirrors `WEEKDAY_COUNT` in `components/journal/week-summary.tsx`. */
export const WEEKDAY_COUNT = 5;

function isDayLogged(day: WeekDayInput): boolean {
  return day.log !== null || day.items.length > 0;
}

/**
 * Pure composition over the same `WeekDayInput[]` + partial `WeekSummary`
 * `buildWeekSummary` already computed — no new queries, no new
 * chain-walking. `carriedOver` (from the rollover-chain collapsing already
 * done there) already answers "still open," so `trackedCount` doesn't need
 * its own planned/done bookkeeping (see docs/journal.md).
 */
export function buildWeekSignals(
  days: WeekDayInput[],
  summary: { doneByDay: WeekDaySummary[]; carriedOver: CarriedOverItem[] }
): WeekSignals {
  const weekdaysLogged = days
    .slice(0, WEEKDAY_COUNT)
    .filter(isDayLogged).length;
  const doneCount = summary.doneByDay.reduce(
    (sum, day) => sum + day.done.length,
    0
  );
  const carriedOverCount = summary.carriedOver.length;

  return {
    weekdaysLogged,
    weekdayCount: WEEKDAY_COUNT,
    doneCount,
    trackedCount: doneCount + carriedOverCount,
    carriedOverCount,
  };
}

/**
 * Renders `WeekSignals` as plain observation sentences — no thresholds, no
 * scores, no streaks (see docs/journal.md). A week with nothing logged at
 * all returns a single friendly line rather than a wall of zeros.
 */
export function weekSignalSentences(signals: WeekSignals): string[] {
  if (signals.weekdaysLogged === 0 && signals.trackedCount === 0) {
    return ["Nothing logged yet this week."];
  }

  const sentences: string[] = [
    `You logged ${signals.weekdaysLogged} of ${signals.weekdayCount} weekdays.`,
  ];

  if (signals.trackedCount > 0) {
    sentences.push(
      `${signals.doneCount} of ${signals.trackedCount} items logged this week got done.`
    );
  }

  if (signals.carriedOverCount > 0) {
    sentences.push(
      `${signals.carriedOverCount} item${signals.carriedOverCount === 1 ? "" : "s"} still carrying over.`
    );
  }

  return sentences;
}
