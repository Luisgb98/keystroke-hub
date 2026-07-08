"use client";

import { formatDistanceToNow } from "date-fns";

import { IDEA_FORMAT_LABEL } from "@/lib/content/idea-format";
import type { IdeaStatus } from "@/lib/content/idea-status";
import type { Idea } from "@/lib/db/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { IDEA_FORMAT_ICON } from "@/components/content/idea-format-styles";

import { MoveMenu } from "./move-menu";

interface BoardCardProps {
  idea: Idea;
  onMove: (idea: Idea, status: IdeaStatus) => void;
}

/**
 * A pipeline card: format + time-in-stage up top, title, and the move
 * control. Deliberately lighter than `IdeaCard` (no notes/tags/delete) — the
 * board is a status-at-a-glance surface, not a replacement for the ideas
 * list (see docs/content-ideas.md).
 */
export function BoardCard({ idea, onMove }: BoardCardProps) {
  const Icon = IDEA_FORMAT_ICON[idea.format];

  return (
    <Card
      data-slot="board-card"
      size="sm"
      className="border-track-content-border"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <Icon aria-hidden className="size-3.5 shrink-0" />
          <span>{IDEA_FORMAT_LABEL[idea.format]}</span>
        </div>
        {/* Relative time is the keystroke accent (mono); absolute time lives in `title` per #16's plan. */}
        <span
          className="font-mono text-caption text-muted-foreground"
          title={idea.stageEnteredAt.toLocaleString()}
        >
          {formatDistanceToNow(idea.stageEnteredAt, { addSuffix: true })}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <h3 className="line-clamp-2 font-heading text-small font-semibold">
          {idea.title}
        </h3>
        <MoveMenu
          ideaTitle={idea.title}
          currentStatus={idea.status}
          onMove={(status) => onMove(idea, status)}
        />
      </CardContent>
    </Card>
  );
}
