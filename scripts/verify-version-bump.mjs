#!/usr/bin/env node
// Verifies that a feature branch bumped package.json's version by exactly
// one semver step, at least as large as the level implied by its commits
// (feat -> minor, fix -> patch, breaking change -> major). See AGENTS.md
// §9 and Issue #6 for the convention this enforces.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CONVENTIONAL_COMMIT_RE = /^(\w+)(\([^)]*\))?(!)?:\s/;
const LEVEL_RANK = { patch: 1, minor: 2, major: 3 };

export function deriveBumpLevel(commitMessages) {
  let hasBreaking = false;
  let hasFeat = false;

  for (const message of commitMessages) {
    const subject = message.split("\n")[0].trim();

    // Merge commits and reverts don't carry an independent bump requirement:
    // a merge just replays commits already counted, and a revert cancels out
    // whatever the reverted commit would have implied.
    if (/^Merge /.test(subject) || /^Revert "/.test(subject)) continue;

    if (/BREAKING CHANGE:/.test(message)) hasBreaking = true;

    const match = subject.match(CONVENTIONAL_COMMIT_RE);
    if (!match) continue;

    const [, type, , breakingBang] = match;
    if (breakingBang) hasBreaking = true;
    if (type === "feat") hasFeat = true;
  }

  if (hasBreaking) return "major";
  if (hasFeat) return "minor";
  // Covers fix-only branches, and chore/docs/test/refactor/style-only
  // branches, which still owe a patch bump per the "one bump per PR" rule.
  return "patch";
}

export function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return null;
  const [, major, minor, patch] = match;
  return { major: Number(major), minor: Number(minor), patch: Number(patch) };
}

/**
 * Classifies the step from `oldVersion` to `newVersion` as "major", "minor",
 * "patch", "none" (unchanged), or "invalid" (downgrade, or anything other
 * than exactly one semver step).
 */
export function classifyBump(oldVersion, newVersion) {
  const oldV = parseSemver(oldVersion);
  const newV = parseSemver(newVersion);
  if (!oldV || !newV) return "invalid";

  if (
    oldV.major === newV.major &&
    oldV.minor === newV.minor &&
    oldV.patch === newV.patch
  ) {
    return "none";
  }

  if (newV.major === oldV.major + 1 && newV.minor === 0 && newV.patch === 0) {
    return "major";
  }

  if (
    newV.major === oldV.major &&
    newV.minor === oldV.minor + 1 &&
    newV.patch === 0
  ) {
    return "minor";
  }

  if (
    newV.major === oldV.major &&
    newV.minor === oldV.minor &&
    newV.patch === oldV.patch + 1
  ) {
    return "patch";
  }

  return "invalid";
}

export function isBumpSufficient(bumpLevel, requiredLevel) {
  if (bumpLevel === "none" || bumpLevel === "invalid") return false;
  return LEVEL_RANK[bumpLevel] >= LEVEL_RANK[requiredLevel];
}

function resolveBaseRef(candidate) {
  for (const ref of [candidate, `origin/${candidate}`]) {
    try {
      execFileSync("git", ["rev-parse", "--verify", ref], { stdio: "ignore" });
      return ref;
    } catch {
      // try the next candidate
    }
  }
  throw new Error(
    `Could not resolve base ref "${candidate}" or "origin/${candidate}".`
  );
}

function getCommitMessages(baseRef) {
  const output = execFileSync(
    "git",
    ["log", `${baseRef}..HEAD`, "--no-merges", "--format=%B%x00"],
    {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    }
  );
  return output
    .split("\x00")
    .map((message) => message.trim())
    .filter(Boolean);
}

function getVersionAt(ref, path = "package.json") {
  const contents = execFileSync("git", ["show", `${ref}:${path}`], {
    encoding: "utf8",
  });
  return JSON.parse(contents).version;
}

function main() {
  const baseRefArg = process.argv[2] ?? "develop";
  const baseRef = resolveBaseRef(baseRefArg);
  const commitMessages = getCommitMessages(baseRef);

  if (commitMessages.length === 0) {
    console.log(`No commits since ${baseRef} — nothing to verify.`);
    return;
  }

  const requiredLevel = deriveBumpLevel(commitMessages);
  const oldVersion = getVersionAt(baseRef);
  const newVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
  const bump = classifyBump(oldVersion, newVersion);

  if (!isBumpSufficient(bump, requiredLevel)) {
    console.error(
      `Version check failed: ${oldVersion} -> ${newVersion} is a "${bump}" change, ` +
        `but this branch's commits require at least a "${requiredLevel}" bump.\n` +
        `Run: pnpm version ${requiredLevel} --no-git-tag-version, then commit as ` +
        `"chore(release): v<new version>".`
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Version check passed: ${oldVersion} -> ${newVersion} (${bump}, required ${requiredLevel}).`
  );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
