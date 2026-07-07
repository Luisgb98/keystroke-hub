import { describe, expect, it } from "vitest";

import { layoutTimedEvents } from "./layout";

function resultFor(id: string, results: ReturnType<typeof layoutTimedEvents>) {
  const result = results.find((r) => r.id === id);
  if (!result) throw new Error(`no layout result for ${id}`);
  return result;
}

describe("layoutTimedEvents", () => {
  it("returns nothing for an empty input", () => {
    expect(layoutTimedEvents([])).toEqual([]);
  });

  it("gives a single event its own full-width column", () => {
    const results = layoutTimedEvents([{ id: "a", start: 0, end: 60 }]);
    expect(results).toEqual([{ id: "a", column: 0, columnCount: 1 }]);
  });

  it("disjoint events each get columnCount 1", () => {
    const results = layoutTimedEvents([
      { id: "a", start: 0, end: 60 },
      { id: "b", start: 60, end: 120 },
      { id: "c", start: 180, end: 240 },
    ]);
    for (const r of results) {
      expect(r.columnCount).toBe(1);
      expect(r.column).toBe(0);
    }
  });

  it("back-to-back events (touching, not overlapping) share column 0", () => {
    const results = layoutTimedEvents([
      { id: "a", start: 0, end: 60 },
      { id: "b", start: 60, end: 120 },
    ]);
    expect(resultFor("a", results).columnCount).toBe(1);
    expect(resultFor("b", results).columnCount).toBe(1);
  });

  it("two overlapping events split into two columns", () => {
    const results = layoutTimedEvents([
      { id: "a", start: 0, end: 60 },
      { id: "b", start: 30, end: 90 },
    ]);
    expect(resultFor("a", results).columnCount).toBe(2);
    expect(resultFor("b", results).columnCount).toBe(2);
    expect(resultFor("a", results).column).not.toBe(
      resultFor("b", results).column
    );
  });

  it("nested events (one fully inside another) split into two columns", () => {
    const results = layoutTimedEvents([
      { id: "outer", start: 0, end: 120 },
      { id: "inner", start: 30, end: 60 },
    ]);
    expect(resultFor("outer", results).columnCount).toBe(2);
    expect(resultFor("inner", results).columnCount).toBe(2);
  });

  it("a chain of partial overlaps forms one cluster sized to its max concurrency", () => {
    // a: 0-60, b: 30-90, c: 80-140 -- a/b overlap, b/c overlap, a/c don't.
    // Max concurrency at any instant is 2, so 2 columns suffice.
    const results = layoutTimedEvents([
      { id: "a", start: 0, end: 60 },
      { id: "b", start: 30, end: 90 },
      { id: "c", start: 80, end: 140 },
    ]);
    expect(resultFor("a", results).columnCount).toBe(2);
    expect(resultFor("b", results).columnCount).toBe(2);
    expect(resultFor("c", results).columnCount).toBe(2);
    // a and c can safely share a column since they never overlap.
    expect(resultFor("a", results).column).toBe(resultFor("c", results).column);
    expect(resultFor("b", results).column).not.toBe(
      resultFor("a", results).column
    );
  });

  it("identical times produce as many columns as events", () => {
    const results = layoutTimedEvents([
      { id: "a", start: 0, end: 60 },
      { id: "b", start: 0, end: 60 },
      { id: "c", start: 0, end: 60 },
    ]);
    for (const r of results) expect(r.columnCount).toBe(3);
    const columns = new Set(results.map((r) => r.column));
    expect(columns.size).toBe(3);
  });

  it("keeps unrelated clusters independent", () => {
    const results = layoutTimedEvents([
      { id: "a", start: 0, end: 60 },
      { id: "b", start: 30, end: 90 },
      { id: "c", start: 500, end: 560 },
    ]);
    expect(resultFor("a", results).columnCount).toBe(2);
    expect(resultFor("c", results).columnCount).toBe(1);
  });

  it("is stable regardless of input order", () => {
    const inOrder = layoutTimedEvents([
      { id: "a", start: 0, end: 60 },
      { id: "b", start: 30, end: 90 },
    ]);
    const reversed = layoutTimedEvents([
      { id: "b", start: 30, end: 90 },
      { id: "a", start: 0, end: 60 },
    ]);
    expect(new Set(inOrder.map((r) => r.columnCount))).toEqual(
      new Set(reversed.map((r) => r.columnCount))
    );
  });
});
