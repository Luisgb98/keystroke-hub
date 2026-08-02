"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/** Pointer movement (px) below this is a click/tap, not a drag. */
export const DRAG_THRESHOLD_PX = 5;
/** Touch hold time before a drag engages, so a scroll swipe isn't mistaken for a lift. */
export const LONG_PRESS_MS = 350;

export interface PointerDragPosition {
  /** Pixel delta from the gesture's origin. */
  dx: number;
  dy: number;
  /** Live viewport coordinates of the pointer — what hit-testing needs. */
  x: number;
  y: number;
}

interface UsePointerDragOptions {
  /** Fired once the moment the drag engages (threshold crossed or long-press fired). */
  onDragStart?: (position: PointerDragPosition) => void;
  /** Live position, fired on every move once the drag has engaged. */
  onDragMove: (position: PointerDragPosition) => void;
  /** Fired once when an engaged drag commits (pointerup). */
  onDragEnd: (position: PointerDragPosition) => void;
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

export interface UsePointerDragResult {
  /** Spread onto the draggable element's pointerdown handler. */
  onPointerDown: (event: ReactPointerEvent) => void;
  isDragging: boolean;
  /**
   * Call from the element's `onClick`. Returns true (and resets) if that
   * click is the tail end of an engaged drag and should be ignored, so a
   * drag-commit doesn't also trigger the element's tap action.
   */
  consumeClickAfterDrag: () => boolean;
}

/**
 * The app's one drag idiom: the pointer gesture state machine shared by the
 * calendar's move/resize interactions and the content board's card moves
 * (`press -> threshold-or-long-press -> dragging -> commit`), on native
 * Pointer Events rather than a drag-and-drop library — one code path for
 * mouse, touch and pen, and zero dependencies (see docs/calendar.md).
 *
 * Geometry is intentionally not this hook's concern: it reports raw pixel
 * deltas plus the live pointer position, and callers convert those with a
 * pure module (`lib/calendar/drag.ts` for px-to-time,
 * `lib/content/board-drag.ts` for pointer-to-column), which keeps that math
 * independently unit-testable.
 */
export function usePointerDrag({
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  disabled,
}: UsePointerDragOptions): UsePointerDragResult {
  const [isDragging, setIsDragging] = useState(false);
  const stateRef = useRef<DragState | null>(null);
  const justDraggedRef = useRef(false);

  const detachListeners = useRef<(() => void) | null>(null);
  const detachScrollBlock = useRef<(() => void) | null>(null);

  const endGesture = useCallback((wasEngaged: boolean) => {
    detachListeners.current?.();
    detachListeners.current = null;
    detachScrollBlock.current?.();
    detachScrollBlock.current = null;
    const state = stateRef.current;
    if (state?.longPressTimer) clearTimeout(state.longPressTimer);
    stateRef.current = null;
    setIsDragging(false);
    if (wasEngaged) justDraggedRef.current = true;
  }, []);

  // A component can be unmounted mid-gesture (a card whose column re-renders,
  // a view swap). The gesture listeners live on `window`, so without this they
  // would outlive it — including the touch-scroll block, which would leave the
  // page unscrollable.
  useEffect(
    () => () => {
      detachListeners.current?.();
      detachScrollBlock.current?.();
    },
    []
  );

  const engage = useCallback(
    (state: DragState, x: number, y: number) => {
      state.engaged = true;
      if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
        state.longPressTimer = null;
      }
      setIsDragging(true);
      // A touch that has been lifted must stop scrolling the page under it.
      // `touch-action: none` can't do this job: it would have to be set
      // before the gesture starts (browsers latch it at touchstart), which
      // would also kill the swipe-to-scroll that starts on a card. Blocking
      // `touchmove` at engage time keeps both — pre-engage swipes scroll
      // natively, an engaged drag doesn't.
      const blockScroll = (event: TouchEvent) => {
        if (event.cancelable) event.preventDefault();
      };
      window.addEventListener("touchmove", blockScroll, { passive: false });
      detachScrollBlock.current = () =>
        window.removeEventListener("touchmove", blockScroll);
      onDragStart?.({ dx: x - state.originX, dy: y - state.originY, x, y });
    },
    [onDragStart]
  );

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
          engage(state, e.clientX, e.clientY);
        }
        onDragMove({ dx, dy, x: e.clientX, y: e.clientY });
      };

      const handlePointerUp = (e: PointerEvent) => {
        if (stateRef.current !== state) return;
        const dx = e.clientX - state.originX;
        const dy = e.clientY - state.originY;
        const wasEngaged = state.engaged;
        endGesture(wasEngaged);
        if (wasEngaged) onDragEnd({ dx, dy, x: e.clientX, y: e.clientY });
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
          if (stateRef.current === state) {
            engage(state, state.originX, state.originY);
          }
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
