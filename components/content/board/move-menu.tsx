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
 * plan ("next stage visually emphasized"). `parked` is a side state, never
 * anyone's "next" stage, and the last stage has none.
 */
function nextStatus(current: IdeaStatus): IdeaStatus | undefined {
  const index = IDEA_STATUSES.indexOf(current);
  const candidate = IDEA_STATUSES[index + 1];
  return candidate && candidate !== "parked" ? candidate : undefined;
}

/**
 * One tap + one tap move control — the acceptance criterion is "items can be
 * moved between stages", not drag-and-drop, which is the worst interaction
 * on a mobile-first board (see docs/content-ideas.md). Lists every *other*
 * stage so re-recording, skipping a script, or reviving a parked idea are
 * all one tap away.
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
            <DropdownMenuItem key={status} onClick={() => onMove(status)}>
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
