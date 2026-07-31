import { describe, expect, it } from "vitest";

import {
  countScriptWords,
  estimateScriptVisualLines,
  formatScriptSize,
  SCRIPT_COLLAPSED_LINES,
  scriptOverflowsCollapsed,
} from "./script-stats";

describe("countScriptWords", () => {
  it("counts nothing in an empty or whitespace-only script", () => {
    expect(countScriptWords("")).toBe(0);
    expect(countScriptWords("   \n\n\t  ")).toBe(0);
  });

  // Naive on purpose: a lone `#` counts as a run. The number answers "did my
  // paste land?", so being one off on markup is not worth a Markdown parse.
  it("counts whitespace-separated runs across lines, markup included", () => {
    expect(countScriptWords("# Cold open\n\nHook them fast.")).toBe(6);
  });

  it("ignores leading and trailing whitespace rather than counting empty runs", () => {
    expect(countScriptWords("\n\n  one two  \n\n")).toBe(2);
  });
});

describe("formatScriptSize", () => {
  it("stays singular for a one-word script", () => {
    expect(formatScriptSize("Hook")).toBe("1 word");
  });

  it("reads zero words for an untouched field", () => {
    expect(formatScriptSize("")).toBe("0 words");
  });

  it("groups thousands so a long paste is readable at a glance", () => {
    const script = Array.from({ length: 12_480 }, () => "word").join(" ");
    expect(formatScriptSize(script)).toBe("12,480 words");
  });
});

describe("estimateScriptVisualLines", () => {
  it("is zero for an empty script", () => {
    expect(estimateScriptVisualLines("")).toBe(0);
  });

  it("counts a short line as one line, blank lines included", () => {
    expect(estimateScriptVisualLines("a\n\nb")).toBe(3);
  });

  it("counts a long paragraph as the wrapped lines it actually occupies", () => {
    // One `\n`-delimited line, but ~4× the field's width.
    expect(estimateScriptVisualLines("x".repeat(192))).toBe(4);
  });
});

describe("scriptOverflowsCollapsed", () => {
  it("says no while the collapsed field can show everything", () => {
    const short = Array.from(
      { length: SCRIPT_COLLAPSED_LINES },
      (_, i) => `line ${i}`
    ).join("\n");
    expect(scriptOverflowsCollapsed(short)).toBe(false);
    expect(scriptOverflowsCollapsed("")).toBe(false);
  });

  it("says yes one line past the cap", () => {
    const tall = Array.from(
      { length: SCRIPT_COLLAPSED_LINES + 1 },
      (_, i) => `line ${i}`
    ).join("\n");
    expect(scriptOverflowsCollapsed(tall)).toBe(true);
  });

  it("catches a single wrapped paragraph, not just many newlines", () => {
    expect(scriptOverflowsCollapsed("x".repeat(500))).toBe(true);
  });
});
