import { appAddMonths, formatInAppZone, parseAppDate } from "@/lib/time";

/**
 * The month-review vocabulary (issue #110). Everything the dashboard's
 * "how did the month go" section needs that isn't a database query lives
 * here: parsing/shifting the `?month=` param, turning it into a query
 * range, and shaping counts into rankings and deltas.
 *
 * Pure by design — no `server-only`, no `getDb` — so the month-boundary and
 * timezone edges (the #95 class of bug) are unit-testable without a
 * database, and the client-side month stepper can import the same
 * arithmetic the server used. Every boundary goes through `lib/time` with
 * the app timezone pinned, per rule 2 of docs/timezone.md.
 */

/** `yyyy-MM` — a calendar month in the app timezone, and the whole `?month=` vocabulary. */
const MONTH_PARAM_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const MONTH_PARAM_FORMAT = "yyyy-MM";

export interface MonthRange {
  /** Inclusive: the first instant of the month, in the app timezone. */
  start: Date;
  /** Exclusive: the first instant of the *next* month — so a row at 23:59:59.999 on the last day still counts. */
  end: Date;
}

/** An instant → the `yyyy-MM` month it falls in, read in the app timezone. */
export function monthParamOf(date: Date): string {
  return formatInAppZone(date, MONTH_PARAM_FORMAT);
}

/** "This month" in the app timezone — the default the dashboard lands on. */
export function currentMonthParam(now: Date = new Date()): string {
  return monthParamOf(now);
}

/**
 * Whether a value is a real `yyyy-MM` month. The shape check rejects
 * `2026-13`; `parseAppDate` then rejects anything well-shaped that still
 * isn't a day the calendar has (a year outside the representable range).
 */
export function isMonthParam(value: unknown): value is string {
  return (
    typeof value === "string" &&
    MONTH_PARAM_PATTERN.test(value) &&
    parseAppDate(`${value}-01`) !== null
  );
}

/**
 * Reads the `?month=` param: missing, malformed, or in the future all fall
 * back to the current month, so the review section can never render a month
 * that hasn't happened (or crash on a hand-typed URL).
 *
 * The future check is a plain string comparison — zero-padded `yyyy-MM`
 * sorts lexicographically the same way it sorts chronologically, so no
 * second date parse is needed.
 */
export function parseMonthParam(
  value: string | string[] | undefined,
  now: Date = new Date()
): string {
  const current = currentMonthParam(now);
  if (typeof value !== "string" || !isMonthParam(value)) return current;
  return value > current ? current : value;
}

/** The half-open instant range a `yyyy-MM` month covers, in the app timezone. */
export function monthRange(month: string): MonthRange {
  const start = parseAppDate(`${month}-01`);
  if (!start) throw new Error(`Not a valid yyyy-MM value: ${month}`);
  return { start, end: appAddMonths(start, 1) };
}

/** Steps a month param by whole calendar months, for the prev/next stepper. */
export function shiftMonthParam(month: string, direction: -1 | 1): string {
  return monthParamOf(appAddMonths(monthRange(month).start, direction));
}

export function isCurrentMonthParam(
  month: string,
  now: Date = new Date()
): boolean {
  return month === currentMonthParam(now);
}

/** e.g. `August 2026` — the review section's heading. */
export function formatMonthLabel(month: string): string {
  return formatInAppZone(monthRange(month).start, "MMMM yyyy");
}

/** e.g. `Aug` — short enough to sit inside a delta line ("+2 vs Jul"). */
export function formatMonthShortLabel(month: string): string {
  return formatInAppZone(monthRange(month).start, "MMM");
}

export interface Countable {
  count: number;
}

export type WithShare<T> = T & {
  /** The row's count as a fraction of the largest row's — the bar's *width*, never the value itself. */
  share: number;
};

/**
 * Adds a bar width to each row, keeping the caller's order.
 *
 * `share` is relative to the *leader*, not to the total: a bar answers "how
 * does this compare with the biggest one", which is what makes a ranking
 * readable, and it means a month with a single game still paints a full bar
 * rather than a sliver. Divide-by-zero is impossible — an all-zero list
 * (an empty month, every pipeline stage at 0) gets `share: 0` rather than
 * `NaN` widths.
 */
export function withShare<T extends Countable>(items: T[]): WithShare<T>[] {
  const max = items.reduce((highest, item) => Math.max(highest, item.count), 0);
  return items.map((item) => ({
    ...item,
    share: max > 0 ? item.count / max : 0,
  }));
}

/**
 * `withShare` plus the ordering: biggest first, ties broken by label so the
 * list can't shuffle between renders, then capped at `limit`.
 */
export function rankItems<T extends Countable & { label: string }>(
  items: T[],
  limit: number
): WithShare<T>[] {
  const ordered = [...items]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
  return withShare(ordered);
}

export type DeltaDirection = "up" | "down" | "flat";

export interface MonthDelta {
  /** Signed difference against the previous month. */
  change: number;
  direction: DeltaDirection;
}

export function buildDelta(current: number, previous: number): MonthDelta {
  const change = current - previous;
  return {
    change,
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

/**
 * The delta as a sentence, e.g. `+2 vs Jul` / `-1 vs Jul` / `Same as Jul`.
 *
 * Deliberately absolute rather than a percentage: these are small counts
 * (three videos, two streams), where "+200%" is noise and "+2" is the
 * fact — and a percentage against a zero month has no honest value at all.
 */
export function formatDeltaLabel(
  delta: MonthDelta,
  previousMonth: string
): string {
  const previousLabel = formatMonthShortLabel(previousMonth);
  if (delta.direction === "flat") return `Same as ${previousLabel}`;
  const sign = delta.change > 0 ? "+" : "-";
  return `${sign}${Math.abs(delta.change)} vs ${previousLabel}`;
}

/** The label the "no game" bucket carries — items without a game are counted, never dropped. */
export const NO_GAME_LABEL = "No game";

export interface GameAttentionTally {
  gameId: string | null;
  gameName: string | null;
  count: number;
}

export interface GameAttention {
  /** `null` for the "no game" bucket, which has no filtered ideas view to link to. */
  gameId: string | null;
  name: string;
  ideaCount: number;
  streamCount: number;
  total: number;
}

/**
 * Folds the per-game idea tally and stream tally into one ranked list.
 *
 * Merged in JS rather than SQL because a game with streams but no ideas
 * (or the other way round) still has to come back with a zero on the empty
 * side — the same reason `getGamesWithUsage` (`lib/data/games.ts`) uses
 * correlated subqueries instead of a double left join. Untagged rows land
 * in a single `null` bucket rather than being dropped, and that bucket
 * sorts after named games on a tie so the ranking reads as a ranking of
 * games first.
 */
export function mergeGameAttention(
  ideaTallies: GameAttentionTally[],
  streamTallies: GameAttentionTally[]
): GameAttention[] {
  const merged = new Map<string, GameAttention>();

  function bucketFor(tally: GameAttentionTally): GameAttention {
    const key = tally.gameId ?? "";
    const existing = merged.get(key);
    if (existing) return existing;
    const created: GameAttention = {
      gameId: tally.gameId,
      name: tally.gameId ? (tally.gameName ?? NO_GAME_LABEL) : NO_GAME_LABEL,
      ideaCount: 0,
      streamCount: 0,
      total: 0,
    };
    merged.set(key, created);
    return created;
  }

  for (const tally of ideaTallies) {
    const bucket = bucketFor(tally);
    bucket.ideaCount += tally.count;
    bucket.total += tally.count;
  }
  for (const tally of streamTallies) {
    const bucket = bucketFor(tally);
    bucket.streamCount += tally.count;
    bucket.total += tally.count;
  }

  return [...merged.values()]
    .filter((game) => game.total > 0)
    .sort(
      (a, b) =>
        b.total - a.total ||
        Number(a.gameId === null) - Number(b.gameId === null) ||
        a.name.localeCompare(b.name)
    );
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * The secondary line under a game's bar, e.g. `3 ideas · 1 stream`. Zero
 * sides are left out rather than printed as "0 streams" — the bar already
 * carries the total, and this line exists to say where it came from.
 */
export function formatGameAttentionDetail(game: GameAttention): string {
  const parts: string[] = [];
  if (game.ideaCount > 0) parts.push(pluralize(game.ideaCount, "idea"));
  if (game.streamCount > 0) parts.push(pluralize(game.streamCount, "stream"));
  return parts.join(" · ");
}
