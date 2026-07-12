import { describe, expect, it } from "vitest";

import {
  IMPROVEMENT_OUTCOME_STATUSES,
  IMPROVEMENT_SELECTABLE_STATUSES,
  IMPROVEMENT_STATUS_LABEL,
  IMPROVEMENT_STATUSES,
  INITIAL_IMPROVEMENT_STATUS,
  isImprovementOutcomeStatus,
  isImprovementStatus,
} from "./improvement-status";

describe("improvement-status", () => {
  it("defines the pipeline vocabulary in pipeline order", () => {
    expect(IMPROVEMENT_STATUSES).toEqual([
      "proposed",
      "discussed",
      "accepted",
      "rejected",
      "done",
    ]);
  });

  it("starts every improvement proposed", () => {
    expect(INITIAL_IMPROVEMENT_STATUS).toBe("proposed");
    expect(IMPROVEMENT_STATUSES).toContain(INITIAL_IMPROVEMENT_STATUS);
  });

  it("has a label for every status", () => {
    for (const status of IMPROVEMENT_STATUSES) {
      expect(IMPROVEMENT_STATUS_LABEL[status]).toBeTruthy();
    }
  });

  it("validates known statuses and rejects unknown ones", () => {
    expect(isImprovementStatus("proposed")).toBe(true);
    expect(isImprovementStatus("done")).toBe(true);
    expect(isImprovementStatus("archived")).toBe(false);
    expect(isImprovementStatus(42)).toBe(false);
    expect(isImprovementStatus(undefined)).toBe(false);
  });

  it("excludes accepted/rejected from the plain status select", () => {
    expect(IMPROVEMENT_SELECTABLE_STATUSES).toEqual([
      "proposed",
      "discussed",
      "done",
    ]);
    expect(IMPROVEMENT_SELECTABLE_STATUSES).not.toContain("accepted");
    expect(IMPROVEMENT_SELECTABLE_STATUSES).not.toContain("rejected");
  });

  it("validates outcome statuses and rejects everything else", () => {
    expect(IMPROVEMENT_OUTCOME_STATUSES).toEqual(["accepted", "rejected"]);
    expect(isImprovementOutcomeStatus("accepted")).toBe(true);
    expect(isImprovementOutcomeStatus("rejected")).toBe(true);
    expect(isImprovementOutcomeStatus("proposed")).toBe(false);
    expect(isImprovementOutcomeStatus(undefined)).toBe(false);
  });
});
