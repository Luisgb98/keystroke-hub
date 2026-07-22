import { describe, expect, it } from "vitest";

import {
  ideaCaptureSchema,
  ideaStatusSchema,
  normalizeTags,
} from "./idea-schema";

describe("normalizeTags", () => {
  it("returns an empty array for empty/undefined input", () => {
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags("")).toEqual([]);
  });

  it("trims, lowercases, and splits on commas", () => {
    expect(normalizeTags(" Tutorial ,  Speedrun,VOD")).toEqual([
      "tutorial",
      "speedrun",
      "vod",
    ]);
  });

  it("drops empty entries from stray commas", () => {
    expect(normalizeTags("tutorial,,  ,speedrun")).toEqual([
      "tutorial",
      "speedrun",
    ]);
  });

  it("dedupes while preserving first-seen order and casing precedent", () => {
    expect(normalizeTags("Tutorial, tutorial, TUTORIAL, speedrun")).toEqual([
      "tutorial",
      "speedrun",
    ]);
  });

  it("truncates an overly long tag rather than rejecting it", () => {
    const longTag = "a".repeat(80);
    const [result] = normalizeTags(longTag);
    expect(result).toHaveLength(50);
  });

  it("caps the number of tags rather than rejecting the whole input", () => {
    const many = Array.from({ length: 30 }, (_, i) => `tag${i}`).join(",");
    expect(normalizeTags(many)).toHaveLength(20);
  });
});

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Speedrun any% commentary",
    notes: "",
    format: undefined,
    tags: undefined,
    ...overrides,
  };
}

describe("ideaCaptureSchema", () => {
  it("accepts a title-only capture and fills in defaults", () => {
    const result = ideaCaptureSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        title: "Speedrun any% commentary",
        notes: null,
        format: "either",
        tags: [],
      });
    }
  });

  it("rejects a blank title", () => {
    const result = ideaCaptureSchema.safeParse(baseInput({ title: "   " }));
    expect(result.success).toBe(false);
  });

  it("rejects a title over 200 characters", () => {
    const result = ideaCaptureSchema.safeParse(
      baseInput({ title: "a".repeat(201) })
    );
    expect(result.success).toBe(false);
  });

  it("accepts full input: notes, format, tags", () => {
    const result = ideaCaptureSchema.safeParse(
      baseInput({
        notes: "Cover the glitch route",
        format: "video",
        tags: "speedrun, glitch",
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe("Cover the glitch route");
      expect(result.data.format).toBe("video");
      expect(result.data.tags).toEqual(["speedrun", "glitch"]);
    }
  });

  it("rejects an invalid format", () => {
    const result = ideaCaptureSchema.safeParse(
      baseInput({ format: "podcast" })
    );
    expect(result.success).toBe(false);
  });

  it("trims whitespace-only notes down to null", () => {
    const result = ideaCaptureSchema.safeParse(baseInput({ notes: "   " }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBeNull();
    }
  });
});

describe("ideaStatusSchema", () => {
  it("accepts a known status", () => {
    const result = ideaStatusSchema.safeParse({
      id: "abc",
      status: "scripted",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    const result = ideaStatusSchema.safeParse({ id: "abc", status: "vibing" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty id", () => {
    const result = ideaStatusSchema.safeParse({ id: "", status: "idea" });
    expect(result.success).toBe(false);
  });
});
