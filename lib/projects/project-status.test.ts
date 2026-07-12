import { describe, expect, it } from "vitest";

import {
  INITIAL_PROJECT_STATUS,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUSES,
  isProjectStatus,
} from "./project-status";

describe("project-status", () => {
  it("defines the pipeline vocabulary in pipeline order", () => {
    expect(PROJECT_STATUSES).toEqual(["active", "paused", "done"]);
  });

  it("starts every project active", () => {
    expect(INITIAL_PROJECT_STATUS).toBe("active");
    expect(PROJECT_STATUSES).toContain(INITIAL_PROJECT_STATUS);
  });

  it("has a label for every status", () => {
    for (const status of PROJECT_STATUSES) {
      expect(PROJECT_STATUS_LABEL[status]).toBeTruthy();
    }
  });

  it("validates known statuses and rejects unknown ones", () => {
    expect(isProjectStatus("active")).toBe(true);
    expect(isProjectStatus("done")).toBe(true);
    expect(isProjectStatus("archived")).toBe(false);
    expect(isProjectStatus(42)).toBe(false);
    expect(isProjectStatus(undefined)).toBe(false);
  });
});
