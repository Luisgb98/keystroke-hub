import "server-only";
import { and, count, eq, gte, inArray, lt, lte, or, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { events, games, ideas, streams } from "@/lib/db/schema";
import { IDEA_STATUSES, type IdeaStatus } from "@/lib/content/idea-status";
import {
  mergeGameAttention,
  type GameAttention,
  type MonthRange,
} from "@/lib/dashboard/month-review";

/**
 * Month-scoped aggregations for the dashboard's month review (issue #110).
 *
 * Every query is bounded by a half-open `[start, end)` instant range built
 * by `monthRange` (`lib/dashboard/month-review.ts`) — the month boundary is
 * decided once, in the app timezone, and handed here as plain instants. No
 * date math happens in this file, which is what keeps the #95 class of bug
 * out of it.
 *
 * No new tables: everything reads `ideas`, `streams`, `events` and `games`.
 */

/**
 * `column ∈ [range.start, range.end)`. Half-open on purpose: `lt(end)` needs
 * no "last millisecond of the month" fudge and stays correct across the DST
 * changeovers that move a month boundary by an hour.
 *
 * Exported so the boundary itself is unit-testable by rendering the
 * condition to SQL (the `PgDialect` trick in `lib/data/ideas.test.ts`).
 */
export function monthCondition(column: PgColumn, range: MonthRange): SQL {
  return and(gte(column, range.start), lt(column, range.end))!;
}

/**
 * What makes an idea count toward a month: it was captured then, or it moved
 * stage then. Either is real attention paid to it that month, and using only
 * one would make a month of pure pipeline movement look empty (or a month of
 * pure capture look like nothing happened).
 */
export function ideaTouchedInMonth(range: MonthRange): SQL {
  return or(
    monthCondition(ideas.createdAt, range),
    monthCondition(ideas.stageEnteredAt, range)
  )!;
}

/**
 * A stream "happened" when its scheduled slot is inside the month *and* in
 * the past — a stream booked for next Friday is a plan, not an output.
 * Streams with no linked event can't be placed in a month at all and are
 * therefore not counted here (see docs/dashboard.md).
 */
function streamHeldCondition(range: MonthRange, now: Date): SQL {
  return and(
    monthCondition(events.startsAt, range),
    lte(events.startsAt, now)
  )!;
}

/** `count(*)` comes back as a bigint the driver hands over as a string — always coerce. */
function toCount(rows: { value: number | string }[]): number {
  return Number(rows[0]?.value ?? 0);
}

export interface MonthOutput {
  /** Ideas that entered `published` this month (see docs/dashboard.md on why `stage_entered_at`). */
  publishedVideos: number;
  streamsHeld: number;
  ideasCreated: number;
}

/** The three headline numbers: what went out, and what came in. */
export async function getMonthOutput(
  range: MonthRange,
  now: Date = new Date()
): Promise<MonthOutput> {
  const db = getDb();
  const [publishedRows, streamRows, createdRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(ideas)
      .where(
        and(
          eq(ideas.status, "published"),
          monthCondition(ideas.stageEnteredAt, range)
        )
      ),
    db
      .select({ value: count() })
      .from(streams)
      .innerJoin(events, eq(streams.eventId, events.id))
      .where(streamHeldCondition(range, now)),
    db
      .select({ value: count() })
      .from(ideas)
      .where(monthCondition(ideas.createdAt, range)),
  ]);

  return {
    publishedVideos: toCount(publishedRows),
    streamsHeld: toCount(streamRows),
    ideasCreated: toCount(createdRows),
  };
}

/** Stages that mean a video is close to (or out of) the door — what "movement" means. */
export const LATE_STAGE_STATUSES: readonly IdeaStatus[] = [
  "recorded",
  "edited",
  "published",
];

export interface PipelineStageCount {
  status: IdeaStatus;
  count: number;
}

export interface PipelineSnapshot {
  /** Every stage, in pipeline order, zero-filled — the shape of the pipeline right now, not just this month. */
  stages: PipelineStageCount[];
  total: number;
  /** Ideas that moved into a late stage during the month — a month of heavy scripting shows up as a zero here. */
  lateStageMoves: number;
}

export async function getPipelineSnapshot(
  range: MonthRange
): Promise<PipelineSnapshot> {
  const db = getDb();
  const [stageRows, lateRows] = await Promise.all([
    db
      .select({ status: ideas.status, value: count() })
      .from(ideas)
      .groupBy(ideas.status),
    db
      .select({ value: count() })
      .from(ideas)
      .where(
        and(
          inArray(ideas.status, [...LATE_STAGE_STATUSES]),
          monthCondition(ideas.stageEnteredAt, range)
        )
      ),
  ]);

  const byStatus = new Map(
    stageRows.map((row) => [row.status, Number(row.value)])
  );
  const stages = IDEA_STATUSES.map((status) => ({
    status,
    count: byStatus.get(status) ?? 0,
  }));

  return {
    stages,
    total: stages.reduce((sum, stage) => sum + stage.count, 0),
    lateStageMoves: toCount(lateRows),
  };
}

/**
 * Which game got the month's attention, across both worlds of content work:
 * ideas touched this month and streams held this month. Untagged rows come
 * back under a `null` game rather than being dropped — the shaping (and the
 * "no game" bucket) is `mergeGameAttention`'s pure job.
 */
export async function getGameAttention(
  range: MonthRange,
  now: Date = new Date()
): Promise<GameAttention[]> {
  const db = getDb();
  const [ideaRows, streamRows] = await Promise.all([
    db
      .select({
        gameId: ideas.gameId,
        gameName: games.name,
        value: count(),
      })
      .from(ideas)
      .leftJoin(games, eq(ideas.gameId, games.id))
      .where(ideaTouchedInMonth(range))
      .groupBy(ideas.gameId, games.name),
    db
      .select({
        gameId: streams.gameId,
        gameName: games.name,
        value: count(),
      })
      .from(streams)
      .innerJoin(events, eq(streams.eventId, events.id))
      .leftJoin(games, eq(streams.gameId, games.id))
      .where(streamHeldCondition(range, now))
      .groupBy(streams.gameId, games.name),
  ]);

  const toTally = (row: {
    gameId: string | null;
    gameName: string | null;
    value: number | string;
  }) => ({
    gameId: row.gameId,
    gameName: row.gameName,
    count: Number(row.value),
  });

  return mergeGameAttention(ideaRows.map(toTally), streamRows.map(toTally));
}

export interface TagUsage {
  tag: string;
  count: number;
}

/**
 * The month's most-used hashtags. Tags are a free-form `text[]` with no
 * normalized table (see docs/content-ideas.md), so this unnests the column —
 * inside a subquery, because Postgres evaluates a set-returning function
 * *after* grouping and would reject `group by` over one in the same select
 * list.
 */
export async function getTagUsage(
  range: MonthRange,
  limit: number
): Promise<TagUsage[]> {
  const db = getDb();
  const result = await db.execute<{ tag: string; count: number | string }>(
    sql`select tag, count(*) as count
        from (
          select unnest(${ideas.tags}) as tag
          from ${ideas}
          where ${ideaTouchedInMonth(range)}
        ) tags
        group by tag
        order by count desc, tag asc
        limit ${limit}`
  );
  return result.rows.map((row) => ({
    tag: row.tag,
    count: Number(row.count),
  }));
}
