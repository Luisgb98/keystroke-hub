"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { GripVertical, ScrollText } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { cn } from "@/lib/utils";
import { IDEA_FORMAT_LABEL } from "@/lib/content/idea-format";
import type { IdeaStatus } from "@/lib/content/idea-status";
import type { Idea } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { IDEA_FORMAT_ICON } from "@/components/content/idea-format-styles";

import { ChecklistChip } from "./checklist-chip";
import { MoveMenu } from "./move-menu";

interface BoardCardProps {
  idea: Idea;
  onMove: (idea: Idea, status: IdeaStatus) => void;
  /** Whether a non-empty script is already saved for this idea (see docs/scripts.md). */
  hasScript?: boolean;
  /** Publish checklist progress — absent/zero-total ideas render no chip (see docs/content-ideas.md). */
  checklistProgress?: { done: number; total: number };
  onOpenChecklist?: (idea: Idea) => void;
  /** This card is the one currently airborne — renders as the gap it left. */
  isDragging?: boolean;
  /** Present when the board wants this card draggable (#89). */
  onDragStart?: (event: ReactPointerEvent) => void;
}

/**
 * A pipeline card: format + time-in-stage up top, title, then one action row
 * (checklist progress on the left, script and move controls on the right).
 * Deliberately lighter than `IdeaCard` (no description/tags/delete) — the
 * board is a status-at-a-glance surface, not a replacement for the ideas
 * list (see docs/content-ideas.md).
 *
 * The card body is the drag handle (#89): a grip glyph advertises it, and the
 * whole surface responds, so a card can be lifted from anywhere that isn't one
 * of its own controls. While airborne it thins out to a placeholder in the
 * column it came from — the `BoardDragPreview` ghost is what follows the
 * pointer.
 */
export function BoardCard({
  idea,
  onMove,
  hasScript = false,
  checklistProgress,
  onOpenChecklist,
  isDragging = false,
  onDragStart,
}: BoardCardProps) {
  const Icon = IDEA_FORMAT_ICON[idea.format];

  function handlePointerDown(event: ReactPointerEvent) {
    if (!onDragStart) return;
    if (!(event.target instanceof Element)) return;
    // React propagates events through the *component* tree, so a press inside
    // the move menu — portalled to `document.body`, but a React child of this
    // card — arrives here too. Lifting the card then captures the pointer and
    // the menu never sees its own click. A DOM containment check is what keeps
    // any portalled surface out of the gesture.
    if (!event.currentTarget.contains(event.target)) return;
    // The script link and the checklist chip own their gestures too.
    if (event.target.closest("a, button")) return;
    onDragStart(event);
  }

  return (
    <Card
      data-slot="board-card"
      data-dragging={isDragging ? "true" : "false"}
      size="sm"
      onPointerDown={handlePointerDown}
      className={cn(
        "gap-2 border-l-2 border-l-track-content-border ring-border transition-[opacity,box-shadow] duration-motion-fast ease-motion-standard hover:ring-track-content-border/60",
        onDragStart && "cursor-grab",
        isDragging &&
          "cursor-grabbing border-dashed opacity-45 ring-track-content-border"
      )}
    >
      <CardHeader className="flex flex-row items-center gap-1.5">
        {onDragStart ? (
          <GripVertical
            aria-hidden
            data-slot="board-card-grip"
            className="-ml-1 size-3.5 shrink-0 text-muted-foreground/50 transition-colors duration-motion-fast group-hover/card:text-muted-foreground"
          />
        ) : null}
        <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <Icon aria-hidden className="size-3.5 shrink-0" />
          <span>{IDEA_FORMAT_LABEL[idea.format]}</span>
        </div>
        {/* Relative time is the keystroke accent (mono); absolute time lives in `title` per #16's plan. */}
        <span
          className="ml-auto font-mono text-caption text-muted-foreground"
          title={idea.stageEnteredAt.toLocaleString()}
        >
          {formatDistanceToNow(idea.stageEnteredAt, { addSuffix: true })}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <h3 className="line-clamp-2 font-heading text-small font-semibold">
          {idea.title}
        </h3>
        <div className="flex items-center gap-1.5">
          {checklistProgress && checklistProgress.total > 0 ? (
            <ChecklistChip
              ideaTitle={idea.title}
              done={checklistProgress.done}
              total={checklistProgress.total}
              onOpen={() => onOpenChecklist?.(idea)}
            />
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${hasScript ? "Open" : "Write"} script for "${idea.title}"`}
              nativeButton={false}
              role="link"
              render={<Link href={`/content/ideas/${idea.id}/script`} />}
            >
              <ScrollText
                aria-hidden
                className={
                  hasScript
                    ? "size-3.5 text-track-content-foreground"
                    : "size-3.5"
                }
              />
            </Button>
            <MoveMenu
              ideaTitle={idea.title}
              currentStatus={idea.status}
              onMove={(status) => onMove(idea, status)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
