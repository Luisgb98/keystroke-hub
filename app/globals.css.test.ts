import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  isWithinSrgbGamut,
  oklchToHex,
  parseOklch,
  type Oklch,
} from "@/lib/color/oklch";

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

/** Reads one token's declared value out of a `:root` / `.dark` block. */
function tokenValue(block: string, token: string): string {
  const match = new RegExp(`--${token}:\\s*([^;]+);`).exec(block);
  expect(match, `expected --${token} to be declared`).not.toBeNull();
  return match![1].trim();
}

/** Reads one token as a parsed OKLCH color, failing if it isn't a literal one. */
function tokenColor(block: string, token: string): Oklch {
  const raw = tokenValue(block, token);
  const color = parseOklch(raw);
  expect(
    color,
    `expected --${token} to be a literal oklch color, got ${raw}`
  ).not.toBeNull();
  return color!;
}

const modes = [
  { name: "light", block: rootBlock },
  { name: "dark", block: darkBlock },
] as const;

/**
 * Hue windows, in OKLCH degrees. Wide enough to allow deliberate tuning inside
 * a family, narrow enough that a drift into a different color fails.
 */
const RED_FAMILY = { min: 5, max: 40 };
const BLUE_FAMILY = { min: 240, max: 265 };

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

  it("declares the brand accent as #a8454b in light mode", () => {
    // The accent is defined by its hex (issue #84) — the oklch triple is just
    // how it's written. If the two stop agreeing, the brand color has moved.
    expect(oklchToHex(tokenColor(rootBlock, "primary"))).toBe("#a8454b");
  });

  it("keeps the sidebar accent in lockstep with the app accent", () => {
    for (const { name, block } of modes) {
      expect(tokenValue(block, "sidebar-primary"), name).toBe(
        tokenValue(block, "primary")
      );
      expect(tokenValue(block, "sidebar-primary-foreground"), name).toBe(
        tokenValue(block, "primary-foreground")
      );
    }
  });

  it("retains no purple anywhere in the file", () => {
    // The retired accent sat at hue ~300. Scan every literal oklch value in the
    // file, not just the tokens we know about.
    const purples = [...css.matchAll(/oklch\([^)]*\)/g)]
      .map((match) => match[0])
      .filter((raw) => {
        const color = parseOklch(raw);
        return (
          color !== null && color.c > 0.01 && color.h > 270 && color.h < 330
        );
      });
    expect(purples).toEqual([]);
  });

  it.each(modes)(
    "derives the accent from the red family in $name mode",
    ({ block }) => {
      for (const token of ["primary", "ring", "sidebar-ring"]) {
        const { h, c } = tokenColor(block, token);
        expect(h, `--${token} hue`).toBeGreaterThanOrEqual(RED_FAMILY.min);
        expect(h, `--${token} hue`).toBeLessThanOrEqual(RED_FAMILY.max);
        expect(c, `--${token} chroma`).toBeGreaterThan(0.02);
      }
    }
  );

  it.each(modes)(
    "derives the content track from the red family in $name mode",
    ({ block }) => {
      for (const token of [
        "track-content",
        "track-content-foreground",
        "track-content-border",
      ]) {
        const { h } = tokenColor(block, token);
        expect(h, `--${token} hue`).toBeGreaterThanOrEqual(RED_FAMILY.min);
        expect(h, `--${token} hue`).toBeLessThanOrEqual(RED_FAMILY.max);
      }
    }
  );

  it.each(modes)("keeps the work track blue in $name mode", ({ block }) => {
    // The two tracks share a calendar — if content's move to red ever dragged
    // work along, the whole dual-track distinction collapses.
    for (const token of [
      "track-work",
      "track-work-foreground",
      "track-work-border",
    ]) {
      const { h } = tokenColor(block, token);
      expect(h, `--${token} hue`).toBeGreaterThanOrEqual(BLUE_FAMILY.min);
      expect(h, `--${token} hue`).toBeLessThanOrEqual(BLUE_FAMILY.max);
    }
  });

  it.each(modes)(
    "keeps the content track subordinate to the accent in $name mode",
    ({ block }) => {
      // Chips and hovers must not compete with primary buttons.
      expect(tokenColor(block, "track-content").c).toBeLessThan(
        tokenColor(block, "primary").c
      );
      expect(tokenColor(block, "track-content-border").c).toBeLessThan(
        tokenColor(block, "primary").c
      );
    }
  );

  it.each(modes)(
    "holds destructive apart from the accent in $name mode",
    ({ block }) => {
      // Both are reds now, so they have to separate on hue *and* chroma —
      // see docs/design-system.md.
      const primary = tokenColor(block, "primary");
      const destructive = tokenColor(block, "destructive");
      expect(Math.abs(destructive.h - primary.h)).toBeGreaterThanOrEqual(8);
      expect(destructive.c).toBeGreaterThan(primary.c * 1.35);
    }
  );

  it("declares every red-family token inside the sRGB gamut", () => {
    // Out-of-gamut values get silently gamut-mapped by the browser, which would
    // mean the painted color isn't the one the contrast test below checked.
    for (const { name, block } of modes) {
      for (const token of [
        "primary",
        "primary-foreground",
        "destructive",
        "ring",
        "sidebar-primary",
        "sidebar-primary-foreground",
        "sidebar-ring",
        "track-content",
        "track-content-foreground",
        "track-content-border",
      ]) {
        const color = tokenColor(block, token);
        expect(
          isWithinSrgbGamut(color),
          `${name} --${token} (${oklchToHex(color)}) falls outside sRGB`
        ).toBe(true);
      }
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

/**
 * WCAG AA, measured rather than eyeballed: 4.5:1 for text, 3:1 for the
 * non-text UI components (focus rings, track borders) covered by SC 1.4.11.
 */
describe("token contrast", () => {
  const AA_TEXT = 4.5;
  const AA_NON_TEXT = 3;

  /** [foreground token, background token] — text pairs that must clear 4.5:1. */
  const textPairs: [string, string][] = [
    ["primary-foreground", "primary"],
    ["sidebar-primary-foreground", "sidebar-primary"],
    ["primary", "background"],
    ["primary", "card"],
    ["destructive", "background"],
    ["destructive", "card"],
    ["track-content-foreground", "track-content"],
    ["track-content-foreground", "background"],
    ["track-content-foreground", "card"],
    ["track-work-foreground", "track-work"],
    ["track-work-foreground", "background"],
  ];

  /** Borders and rings — perceivable at 3:1, not held to the text bar. */
  const nonTextPairs: [string, string][] = [
    ["ring", "background"],
    ["sidebar-ring", "sidebar"],
    ["track-content-border", "background"],
    ["track-work-border", "background"],
  ];

  for (const { name, block } of modes) {
    it.each(textPairs)(
      `${name}: --%s on --%s meets AA for text`,
      (foreground, background) => {
        const ratio = contrastRatio(
          tokenColor(block, foreground),
          tokenColor(block, background)
        );
        expect(
          Number(ratio.toFixed(2)),
          `${name} --${foreground} on --${background}`
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    );

    it.each(nonTextPairs)(
      `${name}: --%s on --%s meets AA for non-text UI`,
      (foreground, background) => {
        const ratio = contrastRatio(
          tokenColor(block, foreground),
          tokenColor(block, background)
        );
        expect(
          Number(ratio.toFixed(2)),
          `${name} --${foreground} on --${background}`
        ).toBeGreaterThanOrEqual(AA_NON_TEXT);
      }
    );
  }
});
