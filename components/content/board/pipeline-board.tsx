"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateIdeaStatus } from "@/lib/content/actions";
import { groupIdeasByStatus } from "@/lib/content/board";
import { IDEA_STATUSES, type IdeaStatus } from "@/lib/content/idea-status";
import type { Idea } from "@/lib/db/schema";

import { PublishChecklistDialog } from "./publish-checklist-dialog";
import { StageColumn } from "./stage-column";

interface PipelineBoardProps {
  ideas: Idea[];
  ideaIdsWithScripts?: Set<string>;
  checklistProgress?: Map<string, { done: number; total: number }>;
}

interface MoveAction {
  id: string;
  status: IdeaStatus;
}

/**
 * The board itself: a horizontally-scrolling, snap-scrolled row of stage
 * columns (the mobile-usability acceptance criterion, no JS needed). Moving
 * a card is optimistic — `useOptimistic` jumps it to the target column
 * instantly; if `updateIdeaStatus` fails, the transition settling without a
 * revalidated `ideas` prop reverts the optimistic state on its own (React's
 * built-in rollback), and a toast surfaces the error (see
 * docs/content-ideas.md).
 */
export function PipelineBoard({
  ideas,
  ideaIdsWithScripts = new Set(),
  checklistProgress,
}: PipelineBoardProps) {
  const [optimisticIdeas, applyMove] = useOptimistic<Idea[], MoveAction>(
    ideas,
    (current, { id, status }) =>
      current.map((idea) =>
        idea.id === id ? { ...idea, status, stageEnteredAt: new Date() } : idea
      )
  );
  const [, startTransition] = useTransition();
  // Owned here (rather than by `ChecklistChip`/`BoardCard`) so the publish
  // nudge toast's "Open checklist" action can open the same dialog a chip
  // tap would (see docs/content-ideas.md).
  const [checklistIdea, setChecklistIdea] = useState<Idea | null>(null);

  function handleMove(idea: Idea, status: IdeaStatus) {
    startTransition(async () => {
      applyMove({ id: idea.id, status });
      const result = await updateIdeaStatus(idea.id, status);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (status === "published" && (result.uncheckedCount ?? 0) > 0) {
        const count = result.uncheckedCount ?? 0;
        toast(
          `Published with ${count} unchecked checklist item${count === 1 ? "" : "s"}`,
          {
            action: {
              label: "Open checklist",
              onClick: () => setChecklistIdea(idea),
            },
          }
        );
      }
    });
  }

  const grouped = groupIdeasByStatus(optimisticIdeas);

  return (
    <div
      data-slot="pipeline-board"
      className="flex flex-1 [scroll-snap-type:x_mandatory] gap-3 overflow-x-auto pb-4"
    >
      {IDEA_STATUSES.map((status) => (
        <StageColumn
          key={status}
          status={status}
          ideas={grouped[status]}
          onMove={handleMove}
          ideaIdsWithScripts={ideaIdsWithScripts}
          checklistProgress={checklistProgress}
          onOpenChecklist={setChecklistIdea}
        />
      ))}

      {checklistIdea ? (
        <PublishChecklistDialog
          ideaId={checklistIdea.id}
          ideaTitle={checklistIdea.title}
          open={checklistIdea !== null}
          onOpenChange={(open) => {
            if (!open) setChecklistIdea(null);
          }}
        />
      ) : null}
    </div>
  );
}
