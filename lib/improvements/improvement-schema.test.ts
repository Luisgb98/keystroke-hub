import { describe, expect, it } from "vitest";

import {
  improvementCaptureSchema,
  improvementDetailsSchema,
  improvementOutcomeSchema,
  improvementStatusSchema,
} from "./improvement-schema";

describe("improvementCaptureSchema", () => {
  it("accepts a title-only capture and fills in defaults", () => {
    const result = improvementCaptureSchema.safeParse({
      title: "Automate the changelog",
      rationale: "",
      projectId: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        title: "Automate the changelog",
        rationale: null,
        projectId: null,
      });
    }
  });

  it("rejects a blank title", () => {
    const result = improvementCaptureSchema.safeParse({
      title: "   ",
      rationale: "",
      projectId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a title over 200 characters", () => {
    const result = improvementCaptureSchema.safeParse({
      title: "a".repeat(201),
      rationale: "",
      projectId: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts rationale and a project id, trimming rationale", () => {
    const result = improvementCaptureSchema.safeParse({
      title: "Automate the changelog",
      rationale: "  saves 20 minutes a release  ",
      projectId: "project-1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rationale).toBe("saves 20 minutes a release");
      expect(result.data.projectId).toBe("project-1");
    }
  });

  it("rejects a rationale over 2000 characters", () => {
    const result = improvementCaptureSchema.safeParse({
      title: "Automate the changelog",
      rationale: "a".repeat(2001),
      projectId: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("improvementDetailsSchema", () => {
  it("accepts a valid edit", () => {
    const result = improvementDetailsSchema.safeParse({
      id: "i-1",
      title: "Renamed",
      rationale: "",
      projectId: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty id", () => {
    const result = improvementDetailsSchema.safeParse({
      id: "",
      title: "Renamed",
      rationale: "",
      projectId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a blank title", () => {
    const result = improvementDetailsSchema.safeParse({
      id: "i-1",
      title: "   ",
      rationale: "",
      projectId: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("improvementStatusSchema", () => {
  it("accepts a selectable status", () => {
    const result = improvementStatusSchema.safeParse({
      id: "i-1",
      status: "discussed",
    });
    expect(result.success).toBe(true);
  });

  it("rejects accepted/rejected — those go through recordImprovementOutcome", () => {
    expect(
      improvementStatusSchema.safeParse({ id: "i-1", status: "accepted" })
        .success
    ).toBe(false);
    expect(
      improvementStatusSchema.safeParse({ id: "i-1", status: "rejected" })
        .success
    ).toBe(false);
  });

  it("rejects an unknown status", () => {
    const result = improvementStatusSchema.safeParse({
      id: "i-1",
      status: "vibing",
    });
    expect(result.success).toBe(false);
  });
});

describe("improvementOutcomeSchema", () => {
  it("accepts accepted/rejected with optional outcome text", () => {
    expect(
      improvementOutcomeSchema.safeParse({
        id: "i-1",
        status: "accepted",
        outcome: "",
      }).success
    ).toBe(true);
    expect(
      improvementOutcomeSchema.safeParse({
        id: "i-1",
        status: "rejected",
        outcome: "Not worth the effort right now",
      }).success
    ).toBe(true);
  });

  it("rejects a status outside accepted/rejected", () => {
    const result = improvementOutcomeSchema.safeParse({
      id: "i-1",
      status: "proposed",
      outcome: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an outcome over 2000 characters", () => {
    const result = improvementOutcomeSchema.safeParse({
      id: "i-1",
      status: "accepted",
      outcome: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});
