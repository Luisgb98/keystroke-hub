import {
  IDEA_STATUSES,
  IDEA_STATUS_LABEL,
  PARKED_IDEA_STATUS,
  type IdeaStatus,
} from "@/lib/content/idea-status";
import type { Idea } from "@/lib/db/schema";

/**
 * Pipeline stages the dashboard's content-in-flight block counts — every
 * stage except `published` (shipped) and `parked` (dead), matching the
 * `getIdeasInFlight` query (`lib/data/ideas.ts`).
 */
export const IN_FLIGHT_STATUSES: readonly IdeaStatus[] = IDEA_STATUSES.filter(
  (status) => status !== "published" && status !== PARKED_IDEA_STATUS
);

export interface StageCount {
  status: IdeaStatus;
  label: string;
  count: number;
}

export interface ContentSnapshot {
  counts: StageCount[];
  total: number;
  /** The in-flight idea that has sat longest in its current stage — the same "stuck longest" signal the board sorts by (`lib/content/board.ts`). */
  stuckIdea: Idea | null;
}

/**
 * Pure per-stage tally for the dashboard's content-in-flight block (issue
 * #28/#16). Filters to in-flight stages itself, so it's safe to call with
 * an unfiltered idea list — the caller isn't required to have pre-filtered
 * via `getIdeasInFlight`.
 */
export function buildContentSnapshot(ideaList: Idea[]): ContentSnapshot {
  const inFlight = ideaList.filter((idea) =>
    IN_FLIGHT_STATUSES.includes(idea.status)
  );

  const counts = IN_FLIGHT_STATUSES.map((status) => ({
    status,
    label: IDEA_STATUS_LABEL[status],
    count: inFlight.filter((idea) => idea.status === status).length,
  }));

  const stuckIdea = inFlight.reduce<Idea | null>(
    (oldest, idea) =>
      !oldest || idea.stageEnteredAt < oldest.stageEnteredAt ? idea : oldest,
    null
  );

  return { counts, total: inFlight.length, stuckIdea };
}
