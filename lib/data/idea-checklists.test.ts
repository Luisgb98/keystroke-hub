// @vitest-environment node
import { describe, expect, it } from "vitest";

import { aggregateChecklistProgress } from "./idea-checklists";

describe("aggregateChecklistProgress", () => {
  it("returns an empty map for no rows", () => {
    expect(aggregateChecklistProgress([]).size).toBe(0);
  });

  it("counts done vs. total per idea", () => {
    const result = aggregateChecklistProgress([
      { ideaId: "i-1", done: true },
      { ideaId: "i-1", done: false },
      { ideaId: "i-1", done: true },
      { ideaId: "i-2", done: false },
    ]);
    expect(result.get("i-1")).toEqual({ done: 2, total: 3 });
    expect(result.get("i-2")).toEqual({ done: 0, total: 1 });
  });
});
