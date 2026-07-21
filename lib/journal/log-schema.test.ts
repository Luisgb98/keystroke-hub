// @vitest-environment node
import { describe, expect, it } from "vitest";

import { assessmentNoteSchema, weeklyRatingSchema } from "./log-schema";

describe("weeklyRatingSchema", () => {
  it("accepts ratings 1 through 5", () => {
    for (let rating = 1; rating <= 5; rating++) {
      const parsed = weeklyRatingSchema.safeParse({
        weekStart: "2026-07-06",
        rating,
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("accepts null to clear a previously-set rating", () => {
    const parsed = weeklyRatingSchema.safeParse({
      weekStart: "2026-07-06",
      rating: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a rating below the range", () => {
    const parsed = weeklyRatingSchema.safeParse({
      weekStart: "2026-07-06",
      rating: 0,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a rating above the range", () => {
    const parsed = weeklyRatingSchema.safeParse({
      weekStart: "2026-07-06",
      rating: 6,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-integer rating", () => {
    const parsed = weeklyRatingSchema.safeParse({
      weekStart: "2026-07-06",
      rating: 3.5,
    });
    expect(parsed.success).toBe(false);
  });

  it("normalizes a non-Monday weekStart to its Monday", () => {
    const parsed = weeklyRatingSchema.safeParse({
      weekStart: "2026-07-08",
      rating: 4,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.weekStart).toBe("2026-07-06");
  });
});

describe("assessmentNoteSchema", () => {
  it("accepts each of the three prompt fields", () => {
    for (const field of ["wentWell", "drainedMe", "changeNext"] as const) {
      const parsed = assessmentNoteSchema.safeParse({
        weekStart: "2026-07-06",
        field,
        value: "Shipped the release",
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("rejects an unknown field", () => {
    const parsed = assessmentNoteSchema.safeParse({
      weekStart: "2026-07-06",
      field: "somethingElse",
      value: "x",
    });
    expect(parsed.success).toBe(false);
  });

  it("trims whitespace-only values to empty (clearing the note)", () => {
    const parsed = assessmentNoteSchema.safeParse({
      weekStart: "2026-07-06",
      field: "wentWell",
      value: "   ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.value).toBe("");
  });

  it("rejects a note over the length cap", () => {
    const parsed = assessmentNoteSchema.safeParse({
      weekStart: "2026-07-06",
      field: "drainedMe",
      value: "x".repeat(2001),
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a note right at the length cap", () => {
    const parsed = assessmentNoteSchema.safeParse({
      weekStart: "2026-07-06",
      field: "changeNext",
      value: "x".repeat(2000),
    });
    expect(parsed.success).toBe(true);
  });
});
