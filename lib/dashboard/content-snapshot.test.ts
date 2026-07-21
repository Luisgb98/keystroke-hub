import { describe, expect, it } from "vitest";

import type { Idea } from "@/lib/db/schema";
import type { IdeaStatus } from "@/lib/content/idea-status";

import { buildContentSnapshot, IN_FLIGHT_STATUSES } from "./content-snapshot";

function makeIdea(
  id: string,
  status: IdeaStatus,
  stageEnteredAt: Date = new Date()
): Idea {
  return {
    id,
    title: `Idea ${id}`,
    notes: null,
    format: "either",
    status,
    tags: [],
    projectId: null,
    stageEnteredAt,
    createdAt: stageEnteredAt,
    updatedAt: stageEnteredAt,
  };
}

describe("buildContentSnapshot", () => {
  it("returns zero counts and no stuck idea for an empty pipeline", () => {
    const snapshot = buildContentSnapshot([]);
    expect(snapshot.total).toBe(0);
    expect(snapshot.stuckIdea).toBeNull();
    for (const stage of snapshot.counts) {
      expect(stage.count).toBe(0);
    }
  });

  it("includes every in-flight stage, even when empty, in pipeline order", () => {
    const snapshot = buildContentSnapshot([]);
    expect(snapshot.counts.map((c) => c.status)).toEqual([
      "spark",
      "outlined",
      "scripted",
      "recorded",
      "edited",
    ]);
    expect(IN_FLIGHT_STATUSES).not.toContain("published");
    expect(IN_FLIGHT_STATUSES).not.toContain("parked");
  });

  it("tallies each stage independently", () => {
    const ideas = [
      makeIdea("1", "spark"),
      makeIdea("2", "spark"),
      makeIdea("3", "scripted"),
    ];
    const snapshot = buildContentSnapshot(ideas);
    expect(snapshot.counts.find((c) => c.status === "spark")?.count).toBe(2);
    expect(snapshot.counts.find((c) => c.status === "scripted")?.count).toBe(1);
    expect(snapshot.total).toBe(3);
  });

  it("excludes published and parked ideas from counts, total, and the stuck pick", () => {
    const ideas = [
      makeIdea("1", "spark", new Date("2026-01-01")),
      makeIdea("2", "published", new Date("2025-01-01")),
      makeIdea("3", "parked", new Date("2024-01-01")),
    ];
    const snapshot = buildContentSnapshot(ideas);
    expect(snapshot.total).toBe(1);
    expect(snapshot.stuckIdea?.id).toBe("1");
  });

  it("picks the idea with the oldest stageEnteredAt as stuck, regardless of input order", () => {
    const newer = makeIdea("newer", "scripted", new Date("2026-07-08"));
    const older = makeIdea("older", "scripted", new Date("2026-07-01"));
    const snapshot = buildContentSnapshot([newer, older]);
    expect(snapshot.stuckIdea?.id).toBe("older");
  });
});
