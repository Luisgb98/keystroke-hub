import { describe, expect, it } from "vitest";

import {
  captureBodySchema,
  isTriageDestination,
  MAX_BODY_LENGTH,
  triagePayloadSchema,
} from "./entry-schema";

describe("captureBodySchema", () => {
  it("accepts a normal thought and trims it", () => {
    const parsed = captureBodySchema.safeParse("  buy a new mic  ");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe("buy a new mic");
  });

  it("rejects an empty body", () => {
    expect(captureBodySchema.safeParse("").success).toBe(false);
  });

  it("rejects a whitespace-only body", () => {
    expect(captureBodySchema.safeParse("   \n\t ").success).toBe(false);
  });

  it("rejects a body past the length cap", () => {
    expect(
      captureBodySchema.safeParse("x".repeat(MAX_BODY_LENGTH + 1)).success
    ).toBe(false);
  });

  it("accepts a body exactly at the length cap", () => {
    expect(
      captureBodySchema.safeParse("x".repeat(MAX_BODY_LENGTH)).success
    ).toBe(true);
  });
});

describe("isTriageDestination", () => {
  it("recognizes the four real destinations", () => {
    expect(isTriageDestination("content_idea")).toBe(true);
    expect(isTriageDestination("improvement")).toBe(true);
    expect(isTriageDestination("daily_log_item")).toBe(true);
    expect(isTriageDestination("meeting_note")).toBe(true);
  });

  it("rejects `discarded` and unknown values (discard is not a triage target)", () => {
    expect(isTriageDestination("discarded")).toBe(false);
    expect(isTriageDestination("nonsense")).toBe(false);
  });
});

describe("triagePayloadSchema", () => {
  it("accepts a content idea with title + notes", () => {
    const parsed = triagePayloadSchema.safeParse({
      type: "content_idea",
      title: "Speedrun retrospective",
      notes: "cover the WR history",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a content idea with a blank title", () => {
    const parsed = triagePayloadSchema.safeParse({
      type: "content_idea",
      title: "   ",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts an improvement with just a title", () => {
    const parsed = triagePayloadSchema.safeParse({
      type: "improvement",
      title: "Automate the changelog",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a daily-log item with a title", () => {
    const parsed = triagePayloadSchema.safeParse({
      type: "daily_log_item",
      title: "Review the PR",
    });
    expect(parsed.success).toBe(true);
  });

  it("requires date, title and notes for a meeting note", () => {
    expect(
      triagePayloadSchema.safeParse({
        type: "meeting_note",
        date: "2026-07-18",
        title: "Sprint planning",
        notes: "discussed the roadmap",
      }).success
    ).toBe(true);

    expect(
      triagePayloadSchema.safeParse({
        type: "meeting_note",
        date: "not-a-date",
        title: "Sprint planning",
        notes: "discussed the roadmap",
      }).success
    ).toBe(false);

    expect(
      triagePayloadSchema.safeParse({
        type: "meeting_note",
        date: "2026-07-18",
        title: "Sprint planning",
        notes: "",
      }).success
    ).toBe(false);
  });

  it("rejects an unknown destination type", () => {
    expect(
      triagePayloadSchema.safeParse({ type: "discarded", title: "x" }).success
    ).toBe(false);
  });
});
