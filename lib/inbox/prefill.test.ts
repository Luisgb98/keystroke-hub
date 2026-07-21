import { describe, expect, it } from "vitest";

import {
  prefillForDestination,
  remainderFromBody,
  singleLineFromBody,
  titleFromBody,
} from "./prefill";

describe("titleFromBody", () => {
  it("takes the first non-empty line", () => {
    expect(titleFromBody("\n\n  Record the intro  \nthen the outro")).toBe(
      "Record the intro"
    );
  });

  it("truncates to 200 characters", () => {
    expect(titleFromBody("x".repeat(250))).toHaveLength(200);
  });

  it("returns an empty string for a blank body", () => {
    expect(titleFromBody("   \n  ")).toBe("");
  });
});

describe("remainderFromBody", () => {
  it("returns everything after the first non-empty line", () => {
    expect(remainderFromBody("Title line\nsecond\nthird")).toBe(
      "second\nthird"
    );
  });

  it("returns an empty string when there's only one line", () => {
    expect(remainderFromBody("just one line")).toBe("");
  });
});

describe("singleLineFromBody", () => {
  it("collapses whitespace to a single line", () => {
    expect(singleLineFromBody("do   the\nthing\n\nnow")).toBe(
      "do the thing now"
    );
  });
});

describe("prefillForDestination", () => {
  const today = "2026-07-18";

  it("splits an idea into title + notes", () => {
    const result = prefillForDestination(
      "New series idea\ncover the whole arc",
      "content_idea",
      today
    );
    expect(result.title).toBe("New series idea");
    expect(result.secondary).toBe("cover the whole arc");
  });

  it("splits an improvement into title + rationale (secondary)", () => {
    const result = prefillForDestination(
      "Cache the build\nit's slow on CI",
      "improvement",
      today
    );
    expect(result.title).toBe("Cache the build");
    expect(result.secondary).toBe("it's slow on CI");
  });

  it("collapses a daily-log item to a single-line title", () => {
    const result = prefillForDestination(
      "call the\nplumber",
      "daily_log_item",
      today
    );
    expect(result.title).toBe("call the plumber");
    expect(result.secondary).toBe("");
  });

  it("keeps the full text as notes for a meeting note and leaves title empty", () => {
    const result = prefillForDestination(
      "sync notes\n- point one",
      "meeting_note",
      today
    );
    expect(result.title).toBe("");
    expect(result.secondary).toBe("sync notes\n- point one");
    expect(result.date).toBe(today);
  });
});
