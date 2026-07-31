import type { IdeaStatus } from "./idea-status";

/** A pointer position in viewport coordinates. */
export interface DropPoint {
  x: number;
  y: number;
}

/** One stage column's live viewport box, as measured from the DOM at drag time. */
export interface ColumnBounds {
  status: IdeaStatus;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Pointer position → the stage column under it, or `null` when the pointer is
 * outside every column.
 *
 * The board has no manual within-column ordering (columns auto-sort
 * oldest-in-stage first, see `groupIdeasByStatus`), so a drop only ever needs
 * to answer "which column?" — no slot index, no reordering math. The whole
 * column box counts, header and empty-state placeholder included, which is
 * what makes an empty column a valid drop target.
 *
 * A miss resolves to `null` rather than snapping to the nearest column: a
 * drop aimed outside the board must never silently change an idea's stage.
 * Zero-area boxes (a column that hasn't been laid out yet) never match, so a
 * pointer at the origin can't be captured by an unmeasured column.
 */
export function resolveDropColumn(
  point: DropPoint,
  columns: ColumnBounds[]
): IdeaStatus | null {
  for (const column of columns) {
    if (column.right <= column.left || column.bottom <= column.top) continue;
    if (
      point.x >= column.left &&
      point.x <= column.right &&
      point.y >= column.top &&
      point.y <= column.bottom
    ) {
      return column.status;
    }
  }
  return null;
}

/**
 * The status a drop should move a card to, or `null` when there's nothing to
 * do — the pointer missed every column, or it came to rest over the card's
 * own column. The board's counterpart to the calendar's `isNoopShift`: a
 * no-op drop must not fire a server action (nor a publish nudge toast).
 */
export function resolveDropMove(
  point: DropPoint,
  columns: ColumnBounds[],
  from: IdeaStatus
): IdeaStatus | null {
  const target = resolveDropColumn(point, columns);
  return target === null || target === from ? null : target;
}
