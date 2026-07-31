"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

import { cn } from "@/lib/utils";
import {
  IDEA_STATUS_EMPTY_STATE_COPY,
  IDEA_STATUS_LABEL,
  type IdeaStatus,
} from "@/lib/content/idea-status";
import type { Idea } from "@/lib/db/schema";

import { BoardCard } from "./board-card";

interface StageColumnProps {
  status: IdeaStatus;
  ideas: Idea[];
  onMove: (idea: Idea, status: IdeaStatus) => void;
  ideaIdsWithScripts?: Set<string>;
  checklistProgress?: Map<string, { done: number; total: number }>;
  onOpenChecklist?: (idea: Idea) => void;
  /** A dragged card is hovering this column — light up the drop indicator. */
  isDropTarget?: boolean;
  /** The airborne card, so this column can render it as a gap in place. */
  draggingIdeaId?: string | null;
  /** Makes this column's cards draggable; absent leaves them tap-only. */
  onCardDragStart?: (idea: Idea, event: ReactPointerEvent) => void;
}

/**
 * One board column: a shelf with its own surface, a header (stage rail, label,
 * mono count) and a scrollable card list, or per-stage empty-state copy so an
 * empty board teaches the pipeline instead of looking broken (see
 * docs/content-ideas.md).
 *
 * The whole shelf is the drop target for a dragged card (#89) — `data-status`
 * is what `measureColumns` hit-tests against, and the indicator is
 * column-level because columns auto-sort oldest-in-stage first, so there is no
 * within-column slot to aim at.
 */
export function StageColumn({
  status,
  ideas,
  onMove,
  ideaIdsWithScripts = new Set(),
  checklistProgress,
  onOpenChecklist,
  isDropTarget = false,
  draggingIdeaId = null,
  onCardDragStart,
}: StageColumnProps) {
  return (
    <section
      data-slot="stage-column"
      data-status={status}
      data-drop-target={isDropTarget ? "true" : "false"}
      className={cn(
        "flex w-[85vw] shrink-0 snap-start flex-col gap-2.5 rounded-2xl border border-border/70 bg-muted/40 p-2.5 transition-colors duration-motion-base ease-motion-standard sm:w-80 dark:bg-muted/25",
        isDropTarget &&
          "border-track-content-border bg-track-content/60 dark:bg-track-content/50"
      )}
    >
      <div className="flex items-center gap-2 px-1">
        {/* The stage rail: the pipeline's own colour, solid accent at the end
            of the line so "shipped" reads differently from "in progress". */}
        <span
          aria-hidden
          className={cn(
            "h-4 w-1 shrink-0 rounded-full",
            status === "published" ? "bg-primary" : "bg-track-content-border"
          )}
        />
        <h2 className="font-heading text-h3 font-semibold">
          {IDEA_STATUS_LABEL[status]}
        </h2>
        <span className="ml-auto rounded-full bg-background px-2 py-0.5 font-mono text-caption text-muted-foreground ring-1 ring-border/70">
          {ideas.length}
        </span>
      </div>

      <div
        data-slot="stage-column-cards"
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto"
      >
        {ideas.length === 0 ? (
          <p
            className={cn(
              "flex flex-1 items-center justify-center rounded-xl border border-dashed border-border px-3 py-6 text-center text-small text-muted-foreground transition-colors duration-motion-base ease-motion-standard",
              isDropTarget &&
                "border-track-content-border text-track-content-foreground"
            )}
          >
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
              isDragging={draggingIdeaId === idea.id}
              onDragStart={
                onCardDragStart
                  ? (event) => onCardDragStart(idea, event)
                  : undefined
              }
            />
          ))
        )}
      </div>
    </section>
  );
}
