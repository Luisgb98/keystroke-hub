import "server-only";
import { asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { ideaChecklistItems, type IdeaChecklistItem } from "@/lib/db/schema";

export interface ChecklistProgress {
  done: number;
  total: number;
}

/**
 * Pure aggregation, split out so it's unit-testable without a database
 * connection (mirrors `aggregateChecklistProgress` in `lib/data/streams.ts`).
 */
export function aggregateChecklistProgress(
  rows: { ideaId: string; done: boolean }[]
): Map<string, ChecklistProgress> {
  const result = new Map<string, ChecklistProgress>();
  for (const row of rows) {
    const progress = result.get(row.ideaId) ?? { done: 0, total: 0 };
    progress.total += 1;
    if (row.done) progress.done += 1;
    result.set(row.ideaId, progress);
  }
  return result;
}

/**
 * One grouped query for every idea's checklist progress — feeds the board's
 * `n/m` chip without a per-card N+1 (see docs/content-ideas.md).
 */
export async function getChecklistProgressForIdeas(
  ideaIds: string[]
): Promise<Map<string, ChecklistProgress>> {
  if (ideaIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({
      ideaId: ideaChecklistItems.ideaId,
      done: ideaChecklistItems.done,
    })
    .from(ideaChecklistItems)
    .where(inArray(ideaChecklistItems.ideaId, ideaIds));
  return aggregateChecklistProgress(rows);
}

export async function getIdeaChecklistItems(
  ideaId: string
): Promise<IdeaChecklistItem[]> {
  const db = getDb();
  return db
    .select()
    .from(ideaChecklistItems)
    .where(eq(ideaChecklistItems.ideaId, ideaId))
    .orderBy(asc(ideaChecklistItems.position));
}
