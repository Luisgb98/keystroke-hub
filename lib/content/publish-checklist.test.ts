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

  it("does not treat early stages or parked as late", () => {
    const earlyOrParked = IDEA_STATUSES.filter(
      (status) => !LATE_IDEA_STATUSES.includes(status)
    );
    expect(earlyOrParked).toEqual(["spark", "outlined", "scripted", "parked"]);
    for (const status of earlyOrParked) {
      expect(isLateStage(status)).toBe(false);
    }
  });
});
