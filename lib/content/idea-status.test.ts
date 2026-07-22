import { describe, expect, it } from "vitest";

import {
  IDEA_STATUS_EMPTY_STATE_COPY,
  IDEA_STATUS_LABEL,
  IDEA_STATUSES,
  INITIAL_IDEA_STATUS,
  isIdeaStatus,
} from "./idea-status";

describe("idea-status", () => {
  it("defines exactly the five pipeline stages in pipeline order", () => {
    expect(IDEA_STATUSES).toEqual([
      "idea",
      "scripted",
      "recorded",
      "edited",
      "published",
    ]);
  });

  it("starts every idea at the idea stage", () => {
    expect(INITIAL_IDEA_STATUS).toBe("idea");
    expect(IDEA_STATUSES).toContain(INITIAL_IDEA_STATUS);
  });

  it("has a label for every status", () => {
    for (const status of IDEA_STATUSES) {
      expect(IDEA_STATUS_LABEL[status]).toBeTruthy();
    }
  });

  it("has board empty-state copy for every status", () => {
    for (const status of IDEA_STATUSES) {
      expect(IDEA_STATUS_EMPTY_STATE_COPY[status]).toBeTruthy();
    }
  });

  it("validates known statuses and rejects unknown ones", () => {
    expect(isIdeaStatus("idea")).toBe(true);
    expect(isIdeaStatus("published")).toBe(true);
    expect(isIdeaStatus("archived")).toBe(false);
    expect(isIdeaStatus(42)).toBe(false);
    expect(isIdeaStatus(undefined)).toBe(false);
  });

  it("no longer recognizes the retired statuses #70 removed", () => {
    expect(isIdeaStatus("spark")).toBe(false);
    expect(isIdeaStatus("outlined")).toBe(false);
    expect(isIdeaStatus("parked")).toBe(false);
  });
});
