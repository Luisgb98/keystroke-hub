export interface LayoutInput {
  id: string;
  /** Minutes (or any consistent unit) since a common origin, e.g. midnight. */
  start: number;
  end: number;
}

export interface LayoutResult {
  id: string;
  /** 0-based column index within this event's overlap cluster. */
  column: number;
  /** Total columns in this event's overlap cluster. */
  columnCount: number;
}

/**
 * Assigns a column/columnCount to each timed event so overlapping events can
 * be rendered side by side. Events that only touch (one ends exactly when
 * another starts) are not treated as overlapping.
 */
export function layoutTimedEvents(events: LayoutInput[]): LayoutResult[] {
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end);

  const clusters: LayoutInput[][] = [];
  let current: LayoutInput[] = [];
  let currentEnd = -Infinity;

  for (const event of sorted) {
    if (current.length === 0 || event.start < currentEnd) {
      current.push(event);
      currentEnd = Math.max(currentEnd, event.end);
    } else {
      clusters.push(current);
      current = [event];
      currentEnd = event.end;
    }
  }
  if (current.length > 0) clusters.push(current);

  const results: LayoutResult[] = [];
  for (const cluster of clusters) {
    const columns: LayoutInput[][] = [];
    const columnOf = new Map<string, number>();

    for (const event of cluster) {
      const column = columns.findIndex((col) => {
        const last = col[col.length - 1];
        return event.start >= last.end;
      });

      if (column === -1) {
        columns.push([event]);
        columnOf.set(event.id, columns.length - 1);
      } else {
        columns[column].push(event);
        columnOf.set(event.id, column);
      }
    }

    const columnCount = columns.length;
    for (const event of cluster) {
      results.push({
        id: event.id,
        column: columnOf.get(event.id)!,
        columnCount,
      });
    }
  }

  return results;
}
