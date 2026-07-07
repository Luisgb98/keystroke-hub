import { describe, expect, it } from "vitest";

import {
  classifyBump,
  deriveBumpLevel,
  isBumpSufficient,
  parseSemver,
} from "./verify-version-bump.mjs";

describe("deriveBumpLevel", () => {
  it("requires only a patch bump when there are no conventional commits", () => {
    expect(deriveBumpLevel(["random text", "wip"])).toBe("patch");
  });

  it("requires a patch bump for fix-only branches", () => {
    expect(deriveBumpLevel(["fix: correct off-by-one error"])).toBe("patch");
  });

  it("requires a patch bump for chore/docs/test/refactor/style-only branches", () => {
    expect(
      deriveBumpLevel([
        "chore: tidy up config",
        "docs: update README",
        "test: add coverage",
        "refactor: extract helper",
        "style: reformat",
      ])
    ).toBe("patch");
  });

  it("requires a minor bump when a feat commit is present", () => {
    expect(deriveBumpLevel(["chore: setup", "feat: add calendar view"])).toBe(
      "minor"
    );
  });

  it("requires a minor bump even if fix commits are also present", () => {
    expect(deriveBumpLevel(["fix: patch bug", "feat: add calendar view"])).toBe(
      "minor"
    );
  });

  it("requires a major bump for a `!` breaking-change marker", () => {
    expect(deriveBumpLevel(["feat!: drop legacy API"])).toBe("major");
  });

  it("requires a major bump for a scoped `!` breaking-change marker", () => {
    expect(deriveBumpLevel(["fix(api)!: change response shape"])).toBe("major");
  });

  it("requires a major bump for a BREAKING CHANGE footer", () => {
    expect(
      deriveBumpLevel([
        "feat: add export\n\nBREAKING CHANGE: removes the old export format",
      ])
    ).toBe("major");
  });

  it("ignores merge commit subjects", () => {
    expect(
      deriveBumpLevel([
        "Merge pull request #12 from feat/foo",
        "Merge branch 'main' into develop",
      ])
    ).toBe("patch");
  });

  it("ignores revert commit subjects instead of misreading the reverted type", () => {
    expect(deriveBumpLevel(['Revert "feat: add calendar view"'])).toBe("patch");
  });

  it("returns patch for an empty commit list", () => {
    expect(deriveBumpLevel([])).toBe("patch");
  });
});

describe("parseSemver", () => {
  it("parses a well-formed x.y.z version", () => {
    expect(parseSemver("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it("returns null for a malformed version", () => {
    expect(parseSemver("1.2")).toBeNull();
    expect(parseSemver("1.2.3-beta")).toBeNull();
    expect(parseSemver("not-a-version")).toBeNull();
  });
});

describe("classifyBump", () => {
  it("classifies an exact patch step", () => {
    expect(classifyBump("0.3.2", "0.3.3")).toBe("patch");
  });

  it("classifies an exact minor step, resetting patch", () => {
    expect(classifyBump("0.3.2", "0.4.0")).toBe("minor");
  });

  it("classifies an exact major step, resetting minor and patch", () => {
    expect(classifyBump("0.3.2", "1.0.0")).toBe("major");
  });

  it("classifies no change as none", () => {
    expect(classifyBump("0.3.2", "0.3.2")).toBe("none");
  });

  it("classifies a downgrade as invalid", () => {
    expect(classifyBump("0.3.2", "0.3.1")).toBe("invalid");
  });

  it("classifies a skipped minor step as invalid", () => {
    expect(classifyBump("0.3.2", "0.5.0")).toBe("invalid");
  });

  it("classifies a minor step that doesn't reset patch as invalid", () => {
    expect(classifyBump("0.3.2", "0.4.2")).toBe("invalid");
  });

  it("classifies a major step that doesn't reset minor/patch as invalid", () => {
    expect(classifyBump("0.3.2", "1.3.2")).toBe("invalid");
  });

  it("classifies a malformed version as invalid", () => {
    expect(classifyBump("0.3.2", "not-a-version")).toBe("invalid");
  });
});

describe("isBumpSufficient", () => {
  it("accepts a bump that matches the required level exactly", () => {
    expect(isBumpSufficient("patch", "patch")).toBe(true);
    expect(isBumpSufficient("minor", "minor")).toBe(true);
    expect(isBumpSufficient("major", "major")).toBe(true);
  });

  it("accepts a bump larger than required", () => {
    expect(isBumpSufficient("minor", "patch")).toBe(true);
    expect(isBumpSufficient("major", "minor")).toBe(true);
  });

  it("rejects a bump smaller than required", () => {
    expect(isBumpSufficient("patch", "minor")).toBe(false);
    expect(isBumpSufficient("minor", "major")).toBe(false);
  });

  it("rejects none and invalid regardless of required level", () => {
    expect(isBumpSufficient("none", "patch")).toBe(false);
    expect(isBumpSufficient("invalid", "patch")).toBe(false);
  });
});
