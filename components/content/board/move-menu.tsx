"use client";

import { ArrowRight, MoveRight } from "lucide-react";

import {
  IDEA_STATUS_LABEL,
  IDEA_STATUSES,
  type IdeaStatus,
} from "@/lib/content/idea-status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MoveMenuProps {
  ideaTitle: string;
  currentStatus: IdeaStatus;
  onMove: (status: IdeaStatus) => void;
}

/**
 * The happy-path next stage — visually emphasized in the menu, per #16's
 * plan ("next stage visually emphasized"). The last stage has none.
 */
function nextStatus(current: IdeaStatus): IdeaStatus | undefined {
  const index = IDEA_STATUSES.indexOf(current);
  return IDEA_STATUSES[index + 1];
}

/**
 * One tap + one tap move control, listing every *other* stage so re-recording
 * or skipping a script are all one tap away.
 *
 * #89 added drag & drop as the board's primary gesture, but this menu stays:
 * it's the only path that works from the keyboard and with a screen reader,
 * and the only one that reaches a stage that isn't on screen (a drag can only
 * target a visible column). Both paths commit through the same `onMove`
 * (see docs/content-ideas.md).
 */
export function MoveMenu({ ideaTitle, currentStatus, onMove }: MoveMenuProps) {
  const next = nextStatus(currentStatus);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Move "${ideaTitle}"`}
          >
            <MoveRight aria-hidden className="size-3.5" />
            Move
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {IDEA_STATUSES.filter((status) => status !== currentStatus).map(
          (status) => (
            <DropdownMenuItem
              key={status}
              onClick={() => onMove(status)}
              className={
                status === next
                  ? "font-medium text-track-content-foreground"
                  : undefined
              }
            >
              {status === next ? (
                <ArrowRight aria-hidden className="size-3.5" />
              ) : null}
              {IDEA_STATUS_LABEL[status]}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
