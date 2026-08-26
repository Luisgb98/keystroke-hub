import { appIsSameDay, formatAppDateParam, parseAppDateTime } from "@/lib/time";

import type { TrackKind } from "./track-kind";

/**
 * Content-track events are single-day (issue #115).
 *
 * A stream and a video release both begin and end on the same day — every one
 * the owner has ever scheduled does — so the second date picker was pure
 * friction, and its stale default (23:00 → next day 00:00) could produce a
 * "two-day release" nobody asked for. Work keeps the full range: meetings,
 * trips and multi-day work items are real.
 *
 * The rule lives here rather than in a Postgres CHECK because "same day" is an
 * app-timezone wall-clock notion (see docs/timezone.md and issue #95);
 * expressing it in SQL would hardcode the timezone into a constraint. Every
 * write path — the editor, drag/resize, and MCP — routes through this module
 * instead.
 *
 * Known limit, accepted deliberately: a stream that genuinely runs past
 * midnight (23:00 → 01:00) can't be represented. It's flagged on the issue.
 */

/** Only work events may span days. `stream` stores as `content`, and both are single-day. */
export function isSingleDayKind(kind: TrackKind): boolean {
  return kind !== "work";
}

/** Whether a span already satisfies the rule, in app-timezone wall-clock days. */
export function isSingleAppDay(startsAt: Date, endsAt: Date): boolean {
  return appIsSameDay(startsAt, endsAt);
}

/**
 * The latest end a single-day event may have: 23:59 on its start's day.
 *
 * Deliberately not midnight-of-the-next-day. That instant reads as a different
 * wall-clock day, which is exactly the state this rule exists to make
 * unrepresentable — and it's the value today's editor defaults produced.
 */
export function endOfStartDay(startsAt: Date): Date {
  const end = parseAppDateTime(formatAppDateParam(startsAt), "23:59");
  // `startsAt` is a real instant, so its own day always re-parses.
  if (!end) throw new Error("unreachable: start has no app-timezone day");
  return end;
}

/**
 * Pulls an end back onto the start's day when it has run past it. Used by
 * drag/resize, which clamps rather than refusing mid-gesture — a resize that
 * silently did nothing would read as a broken drag rather than a rule.
 */
export function clampToStartDay(startsAt: Date, endsAt: Date): Date {
  if (isSingleAppDay(startsAt, endsAt)) return endsAt;
  return endOfStartDay(startsAt);
}

/** The one wording for the rule, so the editor, MCP and the calendar all say the same thing. */
export const SINGLE_DAY_MESSAGE =
  "A stream or release ends the same day it starts — pick a later time on that day.";
