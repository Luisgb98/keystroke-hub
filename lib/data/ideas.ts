import "server-only";
import {
  and,
  arrayContains,
  asc,
  desc,
  eq,
  ilike,
  notInArray,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb } from "@/lib/db";
import { ideas, type Idea } from "@/lib/db/schema";
import type { IdeaFormat } from "@/lib/content/idea-format";
import { type IdeaStatus } from "@/lib/content/idea-status";

/** Statuses the dashboard's content-in-flight block never counts — shipped. */
const NOT_IN_FLIGHT_STATUSES: IdeaStatus[] = ["published"];

export interface IdeaFilters {
  /** Matched case-insensitively against the title. */
  q?: string;
  format?: IdeaFormat;
  status?: IdeaStatus;
  tag?: string;
}

/**
 * Pure filter -> SQL condition mapping, split out from `getIdeas` so it's
 * unit-testable without a database connection (see `idea-filters` in
 * docs/content-ideas.md's test strategy).
 */
export function buildIdeaFilterCondition(
  filters: IdeaFilters
): SQL | undefined {
  const conditions: SQL[] = [];
  if (filters.q) conditions.push(ilike(ideas.title, `%${filters.q}%`));
  if (filters.format) conditions.push(eq(ideas.format, filters.format));
  if (filters.status) conditions.push(eq(ideas.status, filters.status));
  if (filters.tag) conditions.push(arrayContains(ideas.tags, [filters.tag]));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Ideas matching every provided filter, newest first. Filtering/search runs
 * in SQL (not JS) so it stays correct as the idea list grows — see
 * docs/content-ideas.md.
 */
export async function getIdeas(filters: IdeaFilters = {}): Promise<Idea[]> {
  const db = getDb();
  return db
    .select()
    .from(ideas)
    .where(buildIdeaFilterCondition(filters))
    .orderBy(desc(ideas.createdAt));
}

/**
 * Distinct tags currently in use across every idea (not filtered by the
 * current view) — feeds the tag filter picker. Free-form `text[]` tags have
 * no normalized table to select from, so this unnests the array column
 * directly (see docs/content-ideas.md).
 */
export async function getDistinctIdeaTags(): Promise<string[]> {
  const db = getDb();
  const result = await db.execute<{ tag: string }>(
    sql`select distinct unnest(${ideas.tags}) as tag from ${ideas} order by tag`
  );
  return result.rows.map((row) => row.tag);
}

/**
 * Every idea, feeding #16's board — grouping/sorting happens client-side in
 * `groupIdeasByStatus` (`lib/content/board.ts`), which also has to run
 * without a database dependency for the board's optimistic moves.
 */
export async function getIdeasForBoard(): Promise<Idea[]> {
  const db = getDb();
  return db.select().from(ideas);
}

/**
 * Ideas still moving through the pipeline — every status except `published`
 * (shipped) — oldest-in-stage first, feeding the
 * dashboard's content-in-flight block (issue #28/#16). The stage-count
 * tally and stuck-longest pick are computed by the pure
 * `buildContentSnapshot` (`lib/dashboard/content-snapshot.ts`).
 */
export async function getIdeasInFlight(): Promise<Idea[]> {
  const db = getDb();
  return db
    .select()
    .from(ideas)
    .where(notInArray(ideas.status, NOT_IN_FLIGHT_STATUSES))
    .orderBy(asc(ideas.stageEnteredAt));
}
