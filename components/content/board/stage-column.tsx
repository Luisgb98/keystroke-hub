import {
  IDEA_STATUS_EMPTY_STATE_COPY,
  IDEA_STATUS_LABEL,
  PARKED_IDEA_STATUS,
  type IdeaStatus,
} from "@/lib/content/idea-status";
import type { Idea } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

import { BoardCard } from "./board-card";

interface StageColumnProps {
  status: IdeaStatus;
  ideas: Idea[];
  onMove: (idea: Idea, status: IdeaStatus) => void;
  ideaIdsWithScripts?: Set<string>;
  checklistProgress?: Map<string, { done: number; total: number }>;
  onOpenChecklist?: (idea: Idea) => void;
}

/**
 * One board column: header (label + count) and a scrollable card list, or
 * per-stage empty-state copy so an empty board teaches the pipeline instead
 * of looking broken. `parked` renders visually muted — dead ideas shouldn't
 * read as pipeline load (see docs/content-ideas.md).
 */
export function StageColumn({
  status,
  ideas,
  onMove,
  ideaIdsWithScripts = new Set(),
  checklistProgress,
  onOpenChecklist,
}: StageColumnProps) {
  const isParked = status === PARKED_IDEA_STATUS;

  return (
    <div
      data-slot="stage-column"
      className="flex w-[85vw] shrink-0 [scroll-snap-align:start] flex-col gap-3 sm:w-80"
    >
      <div className="flex items-baseline gap-2 px-1">
        <h2
          className={cn(
            "font-heading text-h3 font-semibold",
            isParked && "text-muted-foreground"
          )}
        >
          {IDEA_STATUS_LABEL[status]}
        </h2>
        <span
          className={cn(
            "text-caption text-muted-foreground",
            isParked && "opacity-70"
          )}
        >
          {ideas.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {ideas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-small text-muted-foreground">
            {IDEA_STATUS_EMPTY_STATE_COPY[status]}
          </p>
        ) : (
          ideas.map((idea) => (
            <BoardCard
              key={idea.id}
              idea={idea}
              onMove={onMove}
              hasScript={ideaIdsWithScripts.has(idea.id)}
              checklistProgress={checklistProgress?.get(idea.id)}
              onOpenChecklist={onOpenChecklist}
            />
          ))
        )}
      </div>
    </div>
  );
}
