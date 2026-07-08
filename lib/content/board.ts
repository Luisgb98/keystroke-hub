import type { Idea } from "@/lib/db/schema";

import { IDEA_STATUSES, type IdeaStatus } from "./idea-status";

/** One bucket per pipeline stage, in pipeline order — every status gets an entry, even if empty. */
export type IdeasByStatus = Record<IdeaStatus, Idea[]>;

/**
 * Pure grouping + sorting for #16's board. No database dependency (unlike
 * `lib/data/ideas.ts`, which is `server-only`) since `PipelineBoard` — a
 * Client Component — recomputes this on every optimistic move. Each bucket
 * sorts oldest-in-stage first (by `stageEnteredAt`), the signal the board
 * exists to surface — so the card that's been stuck longest shows up first,
 * regardless of the input order (also what keeps an optimistic move
 * correctly positioned without a server round-trip, see docs/content-ideas.md).
 */
export function groupIdeasByStatus(ideaList: Idea[]): IdeasByStatus {
  const grouped = Object.fromEntries(
    IDEA_STATUSES.map((status) => [status, [] as Idea[]])
  ) as IdeasByStatus;
  for (const idea of ideaList) {
    grouped[idea.status].push(idea);
  }
  for (const bucket of Object.values(grouped)) {
    bucket.sort(
      (a, b) => a.stageEnteredAt.getTime() - b.stageEnteredAt.getTime()
    );
  }
  return grouped;
}
