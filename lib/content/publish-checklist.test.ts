import { describe, expect, it } from "vitest";

import { IDEA_STATUSES } from "./idea-status";
import {
  DEFAULT_PUBLISH_CHECKLIST_ITEMS,
  LATE_IDEA_STATUSES,
  isLateStage,
} from "./publish-checklist";

describe("publish-checklist", () => {
  it("defines the four default items", () => {
    expect(DEFAULT_PUBLISH_CHECKLIST_ITEMS).toEqual([
      "Title",
      "Thumbnail",
      "Description",
      "Tags",
    ]);
  });

  it("treats recorded, edited, and published as late stages", () => {
    expect(LATE_IDEA_STATUSES).toEqual(["recorded", "edited", "published"]);
    for (const status of LATE_IDEA_STATUSES) {
      expect(isLateStage(status)).toBe(true);
    }
  });

  it("does not treat early stages as late", () => {
    const early = IDEA_STATUSES.filter(
      (status) => !LATE_IDEA_STATUSES.includes(status)
    );
    expect(early).toEqual(["idea", "scripted"]);
    for (const status of early) {
      expect(isLateStage(status)).toBe(false);
    }
  });
});
