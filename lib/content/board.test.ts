import { describe, expect, it } from "vitest";

import type { Idea } from "@/lib/db/schema";
import type { IdeaStatus } from "@/lib/content/idea-status";

import { groupIdeasByStatus } from "./board";

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

describe("groupIdeasByStatus", () => {
  it("gives every pipeline stage a bucket, even when empty", () => {
    const grouped = groupIdeasByStatus([]);
    expect(Object.keys(grouped)).toEqual([
      "idea",
      "scripted",
      "recorded",
      "edited",
      "published",
    ]);
    for (const bucket of Object.values(grouped)) {
      expect(bucket).toEqual([]);
    }
  });

  it("buckets each idea under its own status", () => {
    const idea = makeIdea("1", "idea");
    const scripted = makeIdea("2", "scripted");
    const published = makeIdea("3", "published");
    const grouped = groupIdeasByStatus([idea, scripted, published]);

    expect(grouped.idea).toEqual([idea]);
    expect(grouped.scripted).toEqual([scripted]);
    expect(grouped.published).toEqual([published]);
    expect(grouped.recorded).toEqual([]);
  });

  it("sorts each bucket oldest-in-stage first, regardless of input order", () => {
    const newer = makeIdea("newer", "scripted", new Date("2026-07-08"));
    const older = makeIdea("older", "scripted", new Date("2026-07-01"));
    const grouped = groupIdeasByStatus([newer, older]);
    expect(grouped.scripted).toEqual([older, newer]);
  });
});
