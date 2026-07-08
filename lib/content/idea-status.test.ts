import { describe, expect, it } from "vitest";

import {
  IDEA_STATUS_LABEL,
  IDEA_STATUSES,
  INITIAL_IDEA_STATUS,
  isIdeaStatus,
} from "./idea-status";

describe("idea-status", () => {
  it("defines the full pipeline vocabulary in pipeline order", () => {
    expect(IDEA_STATUSES).toEqual([
      "spark",
      "outlined",
      "scripted",
      "recorded",
      "published",
      "parked",
    ]);
  });

  it("starts every idea at the spark stage", () => {
    expect(INITIAL_IDEA_STATUS).toBe("spark");
    expect(IDEA_STATUSES).toContain(INITIAL_IDEA_STATUS);
  });

  it("has a label for every status", () => {
    for (const status of IDEA_STATUSES) {
      expect(IDEA_STATUS_LABEL[status]).toBeTruthy();
    }
  });

  it("validates known statuses and rejects unknown ones", () => {
    expect(isIdeaStatus("spark")).toBe(true);
    expect(isIdeaStatus("published")).toBe(true);
    expect(isIdeaStatus("archived")).toBe(false);
    expect(isIdeaStatus(42)).toBe(false);
    expect(isIdeaStatus(undefined)).toBe(false);
  });
});
