import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "globals.css"), "utf-8");

function extractBlock(selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(
    start,
    `expected a "${selector} {" block in globals.css`
  ).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n}", start);
  return css.slice(start, end);
}

const rootBlock = extractBlock(":root");
const darkBlock = extractBlock(".dark");

const semanticTokens = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
];

const trackTokens = [
  "track-work",
  "track-work-foreground",
  "track-work-border",
  "track-content",
  "track-content-foreground",
  "track-content-border",
];

describe("design tokens contract", () => {
  it.each(semanticTokens)("defines --%s in :root and .dark", (token) => {
    expect(rootBlock).toMatch(new RegExp(`--${token}:`));
    expect(darkBlock).toMatch(new RegExp(`--${token}:`));
  });

  it.each(trackTokens)(
    "defines dual-track token --%s in :root and .dark",
    (token) => {
      expect(rootBlock).toMatch(new RegExp(`--${token}:`));
      expect(darkBlock).toMatch(new RegExp(`--${token}:`));
    }
  );

  it("maps every dual-track token into the Tailwind theme via @theme inline", () => {
    const themeBlock = extractBlock("@theme inline");
    for (const token of trackTokens) {
      expect(themeBlock).toMatch(
        new RegExp(`--color-${token}: var\\(--${token}\\);`)
      );
    }
  });

  it("zeroes motion durations under prefers-reduced-motion", () => {
    const reducedMotionStart = css.indexOf(
      "@media (prefers-reduced-motion: reduce)"
    );
    expect(reducedMotionStart).toBeGreaterThanOrEqual(0);
    const reducedMotionBlock = css.slice(
      reducedMotionStart,
      reducedMotionStart + 200
    );
    expect(reducedMotionBlock).toMatch(/--motion-fast: 0ms/);
    expect(reducedMotionBlock).toMatch(/--motion-base: 0ms/);
    expect(reducedMotionBlock).toMatch(/--motion-slow: 0ms/);
  });
});
