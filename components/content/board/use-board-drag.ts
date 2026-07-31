"use client";

import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { usePointerDrag } from "@/hooks/use-pointer-drag";
import {
  resolveDropColumn,
  resolveDropMove,
  type ColumnBounds,
  type DropPoint,
} from "@/lib/content/board-drag";
import { isIdeaStatus, type IdeaStatus } from "@/lib/content/idea-status";
import type { Idea } from "@/lib/db/schema";

/** Marks a column as a drop target; also how the e2e specs find columns. */
export const STAGE_COLUMN_SELECTOR = '[data-slot="stage-column"]';

/**
 * Reads every column's live box out of the DOM. Measured per pointer move
 * rather than once at lift, so a board that scrolls mid-drag (or a column
 * whose height changes as cards leave it) still hit-tests against where the
 * columns actually are. Five `getBoundingClientRect()` reads per move, no
 * writes in between — cheap enough to stay off the jank budget.
 */
export function measureColumns(board: HTMLElement | null): ColumnBounds[] {
  if (!board) return [];
  return Array.from(
    board.querySelectorAll<HTMLElement>(STAGE_COLUMN_SELECTOR)
  ).flatMap((element) => {
    const status = element.dataset.status;
    if (!isIdeaStatus(status)) return [];
    const { left, right, top, bottom } = element.getBoundingClientRect();
    return [{ status, left, right, top, bottom }];
  });
}

interface DragState {
  idea: Idea;
  point: DropPoint;
  dropTarget: IdeaStatus | null;
}

export interface BoardDrag {
  /** The airborne card, or null when no drag is engaged. */
  draggingIdea: Idea | null;
  /** Where the floating preview follows the pointer. */
  point: DropPoint | null;
  /** The column under the pointer — renders the drop indicator. */
  dropTarget: IdeaStatus | null;
  /** Wire to a card's `onPointerDown` to make it draggable. */
  startDrag: (idea: Idea, event: ReactPointerEvent) => void;
}

interface UseBoardDragOptions {
  /** The scrolling board element the columns are measured from. */
  boardRef: RefObject<HTMLElement | null>;
  /** Commits a completed drag — the same move path the fallback menu uses. */
  onDrop: (idea: Idea, status: IdeaStatus) => void;
}

/**
 * Card drag & drop for the pipeline board (#89), on the app's shared
 * `usePointerDrag` state machine — so touch gets the same long-press lift and
 * pre-engage swipe-to-scroll disambiguation the calendar has, with no new
 * dependency.
 *
 * The gesture lives here, once, rather than in each `BoardCard`: only one card
 * can be airborne at a time, and the hit-test needs the board element anyway.
 * Cards just hand their idea to `startDrag` on pointerdown. The commit path is
 * `onDrop` — i.e. the very same `handleMove` the `MoveMenu` calls, so the
 * optimistic update, rollback-on-failure and publish nudge toast are shared by
 * both paths rather than reimplemented for dragging.
 */
export function useBoardDrag({
  boardRef,
  onDrop,
}: UseBoardDragOptions): BoardDrag {
  const [state, setState] = useState<DragState | null>(null);
  // The pressed card, captured before the gesture engages: `usePointerDrag`
  // reports positions, not what's being dragged.
  const pressedIdeaRef = useRef<Idea | null>(null);

  const trackPointer = useCallback(
    (point: DropPoint) => {
      const idea = pressedIdeaRef.current;
      if (!idea) return;
      setState({
        idea,
        point,
        dropTarget: resolveDropColumn(point, measureColumns(boardRef.current)),
      });
    },
    [boardRef]
  );

  const drag = usePointerDrag({
    onDragStart: ({ x, y }) => trackPointer({ x, y }),
    onDragMove: ({ x, y }) => trackPointer({ x, y }),
    onDragEnd: ({ x, y }) => {
      const idea = pressedIdeaRef.current;
      pressedIdeaRef.current = null;
      setState(null);
      if (!idea) return;
      const target = resolveDropMove(
        { x, y },
        measureColumns(boardRef.current),
        idea.status
      );
      if (target) onDrop(idea, target);
    },
    onDragCancel: () => {
      pressedIdeaRef.current = null;
      setState(null);
    },
  });

  const startDrag = useCallback(
    (idea: Idea, event: ReactPointerEvent) => {
      pressedIdeaRef.current = idea;
      drag.onPointerDown(event);
    },
    [drag]
  );

  return {
    draggingIdea: state?.idea ?? null,
    point: state?.point ?? null,
    dropTarget: state?.dropTarget ?? null,
    startDrag,
  };
}
