"use client";

import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { DRAG_THRESHOLD_PX, LONG_PRESS_MS } from "@/lib/calendar/drag";

export interface PointerDelta {
  dx: number;
  dy: number;
}

interface UseEventDragOptions {
  /** Live pixel delta from the gesture's origin, fired once the drag has engaged. */
  onDragMove: (delta: PointerDelta) => void;
  /** Fired once when an engaged drag commits (pointerup). */
  onDragEnd: (delta: PointerDelta) => void;
  /** Fired when an engaged drag is aborted (Escape or pointercancel). */
  onDragCancel: () => void;
  /** Suppresses the gesture entirely, e.g. while another drag is in flight. */
  disabled?: boolean;
}

interface DragState {
  pointerId: number;
  originX: number;
  originY: number;
  pointerType: string;
  engaged: boolean;
  longPressTimer: ReturnType<typeof setTimeout> | null;
}

export interface UseEventDragResult {
  /** Spread onto the draggable element's pointerdown handler. */
  onPointerDown: (event: ReactPointerEvent) => void;
  isDragging: boolean;
  /**
   * Call from the element's `onClick`. Returns true (and resets) if that
   * click is the tail end of an engaged drag and should be ignored, so a
   * drag-commit doesn't also reopen the editor.
   */
  consumeClickAfterDrag: () => boolean;
}

/**
 * Owns the pointer gesture state machine shared by move and resize
 * interactions: press -> (threshold or long-press) -> dragging -> commit.
 * Geometry (px-to-time conversion) is intentionally not this hook's concern
 * — callers convert the raw pixel delta using lib/calendar/drag.ts, which
 * keeps that math independently unit-testable.
 */
export function useEventDrag({
  onDragMove,
  onDragEnd,
  onDragCancel,
  disabled,
}: UseEventDragOptions): UseEventDragResult {
  const [isDragging, setIsDragging] = useState(false);
  const stateRef = useRef<DragState | null>(null);
  const justDraggedRef = useRef(false);

  const detachListeners = useRef<(() => void) | null>(null);

  const endGesture = useCallback((wasEngaged: boolean) => {
    detachListeners.current?.();
    detachListeners.current = null;
    const state = stateRef.current;
    if (state?.longPressTimer) clearTimeout(state.longPressTimer);
    stateRef.current = null;
    setIsDragging(false);
    if (wasEngaged) justDraggedRef.current = true;
  }, []);

  const engage = useCallback((state: DragState) => {
    state.engaged = true;
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
    setIsDragging(true);
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (disabled) return;
      if (event.button !== 0 && event.pointerType === "mouse") return;

      const target = event.currentTarget;
      target.setPointerCapture?.(event.pointerId);

      const state: DragState = {
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        pointerType: event.pointerType,
        engaged: false,
        longPressTimer: null,
      };
      stateRef.current = state;

      const handlePointerMove = (e: PointerEvent) => {
        if (stateRef.current !== state) return;
        const dx = e.clientX - state.originX;
        const dy = e.clientY - state.originY;

        if (!state.engaged) {
          if (state.pointerType === "touch") {
            // Movement before the long-press timer fires reads as a scroll
            // swipe, not a lift — cancel and let the native scroll proceed.
            if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX * 2) {
              endGesture(false);
            }
            return;
          }
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
          engage(state);
        }
        onDragMove({ dx, dy });
      };

      const handlePointerUp = (e: PointerEvent) => {
        if (stateRef.current !== state) return;
        const dx = e.clientX - state.originX;
        const dy = e.clientY - state.originY;
        const wasEngaged = state.engaged;
        endGesture(wasEngaged);
        if (wasEngaged) onDragEnd({ dx, dy });
      };

      const handlePointerCancel = () => {
        if (stateRef.current !== state) return;
        const wasEngaged = state.engaged;
        endGesture(false);
        if (wasEngaged) onDragCancel();
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== "Escape") return;
        if (stateRef.current !== state) return;
        const wasEngaged = state.engaged;
        endGesture(false);
        if (wasEngaged) onDragCancel();
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
      window.addEventListener("keydown", handleKeyDown);
      detachListeners.current = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
        window.removeEventListener("keydown", handleKeyDown);
      };

      if (event.pointerType === "touch") {
        state.longPressTimer = setTimeout(() => {
          if (stateRef.current === state) engage(state);
        }, LONG_PRESS_MS);
      }
    },
    [disabled, engage, endGesture, onDragMove, onDragEnd, onDragCancel]
  );

  const consumeClickAfterDrag = useCallback(() => {
    if (!justDraggedRef.current) return false;
    justDraggedRef.current = false;
    return true;
  }, []);

  return { onPointerDown, isDragging, consumeClickAfterDrag };
}
