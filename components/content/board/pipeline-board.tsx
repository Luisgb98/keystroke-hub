"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { updateIdeaStatus } from "@/lib/content/actions";
import { groupIdeasByStatus } from "@/lib/content/board";
import { IDEA_STATUSES, type IdeaStatus } from "@/lib/content/idea-status";
import type { Idea } from "@/lib/db/schema";

import { StageColumn } from "./stage-column";

interface PipelineBoardProps {
  ideas: Idea[];
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
export function PipelineBoard({ ideas }: PipelineBoardProps) {
  const [optimisticIdeas, applyMove] = useOptimistic<Idea[], MoveAction>(
    ideas,
    (current, { id, status }) =>
      current.map((idea) =>
        idea.id === id ? { ...idea, status, stageEnteredAt: new Date() } : idea
      )
  );
  const [, startTransition] = useTransition();

  function handleMove(idea: Idea, status: IdeaStatus) {
    startTransition(async () => {
      applyMove({ id: idea.id, status });
      const result = await updateIdeaStatus(idea.id, status);
      if (result.error) {
        toast.error(result.error);
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
        />
      ))}
    </div>
  );
}
