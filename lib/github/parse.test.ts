import { describe, expect, it } from "vitest";

import {
  formatGithubIssueRef,
  githubIssueUrl,
  parseGithubIssueRef,
} from "./parse";

describe("parseGithubIssueRef", () => {
  it("parses the owner/repo#123 shorthand", () => {
    const result = parseGithubIssueRef("Luisgb98/keystroke-hub#27");
    expect(result).toEqual({
      ok: true,
      ref: { owner: "Luisgb98", repo: "keystroke-hub", issueNumber: 27 },
    });
  });

  it("parses a full issue URL", () => {
    const result = parseGithubIssueRef(
      "https://github.com/Luisgb98/keystroke-hub/issues/27"
    );
    expect(result).toEqual({
      ok: true,
      ref: { owner: "Luisgb98", repo: "keystroke-hub", issueNumber: 27 },
    });
  });

  it("parses a pull request URL", () => {
    const result = parseGithubIssueRef(
      "https://github.com/Luisgb98/keystroke-hub/pull/61"
    );
    expect(result).toEqual({
      ok: true,
      ref: { owner: "Luisgb98", repo: "keystroke-hub", issueNumber: 61 },
    });
  });

  it("ignores a trailing slash", () => {
    const result = parseGithubIssueRef(
      "https://github.com/Luisgb98/keystroke-hub/issues/27/"
    );
    expect(result.ok).toBe(true);
  });

  it("ignores a query string", () => {
    const result = parseGithubIssueRef(
      "https://github.com/Luisgb98/keystroke-hub/issues/27?tab=comments"
    );
    expect(result.ok).toBe(true);
  });

  it("tolerates surrounding whitespace", () => {
    const result = parseGithubIssueRef("  Luisgb98/keystroke-hub#27  ");
    expect(result.ok).toBe(true);
  });

  it("accepts www.github.com", () => {
    const result = parseGithubIssueRef(
      "https://www.github.com/Luisgb98/keystroke-hub/issues/27"
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a non-GitHub host", () => {
    const result = parseGithubIssueRef(
      "https://gitlab.com/Luisgb98/keystroke-hub/issues/27"
    );
    expect(result).toEqual({
      ok: false,
      error: "Paste a GitHub issue URL or owner/repo#123.",
    });
  });

  it("rejects a URL missing the issue/pull segment", () => {
    const result = parseGithubIssueRef(
      "https://github.com/Luisgb98/keystroke-hub"
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a non-numeric issue number", () => {
    const result = parseGithubIssueRef("Luisgb98/keystroke-hub#abc");
    expect(result.ok).toBe(false);
  });

  it("rejects issue number zero", () => {
    const result = parseGithubIssueRef("Luisgb98/keystroke-hub#0");
    expect(result.ok).toBe(false);
  });

  it("rejects an owner starting with a hyphen", () => {
    const result = parseGithubIssueRef("-bad/repo#1");
    expect(result.ok).toBe(false);
  });

  it("rejects an owner with consecutive hyphens", () => {
    const result = parseGithubIssueRef("bad--owner/repo#1");
    expect(result.ok).toBe(false);
  });

  it("rejects garbage input", () => {
    const result = parseGithubIssueRef("not a github reference at all");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = parseGithubIssueRef("   ");
    expect(result.ok).toBe(false);
  });
});

describe("formatGithubIssueRef", () => {
  it("formats owner/repo#number", () => {
    expect(
      formatGithubIssueRef({
        owner: "Luisgb98",
        repo: "keystroke-hub",
        issueNumber: 27,
      })
    ).toBe("Luisgb98/keystroke-hub#27");
  });
});

describe("githubIssueUrl", () => {
  it("derives the issues URL, never a pull URL", () => {
    expect(
      githubIssueUrl({
        owner: "Luisgb98",
        repo: "keystroke-hub",
        issueNumber: 61,
      })
    ).toBe("https://github.com/Luisgb98/keystroke-hub/issues/61");
  });
});
