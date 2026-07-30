import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  isWithinSrgbGamut,
  oklchToHex,
  oklchToSrgb,
  parseOklch,
  relativeLuminance,
  type Oklch,
} from "./oklch";

const WHITE: Oklch = { l: 1, c: 0, h: 0, alpha: 1 };
const BLACK: Oklch = { l: 0, c: 0, h: 0, alpha: 1 };

describe("parseOklch", () => {
  it("parses the three-component form used throughout globals.css", () => {
    expect(parseOklch("oklch(0.524 0.131 19.1)")).toEqual({
      l: 0.524,
      c: 0.131,
      h: 19.1,
      alpha: 1,
    });
  });

  it("parses an alpha slash suffix as a fraction", () => {
    expect(parseOklch("oklch(1 0 0 / 10%)")).toEqual({
      l: 1,
      c: 0,
      h: 0,
      alpha: 0.1,
    });
    expect(parseOklch("oklch(0 0 0 / 0.45)")?.alpha).toBe(0.45);
  });

  it("parses a percentage lightness", () => {
    expect(parseOklch("oklch(52.4% 0.131 19.1)")?.l).toBeCloseTo(0.524, 5);
  });

  it("tolerates surrounding whitespace and a deg-suffixed hue", () => {
    expect(parseOklch("  oklch(0.5 0.1 20deg)  ")).toEqual({
      l: 0.5,
      c: 0.1,
      h: 20,
      alpha: 1,
    });
  });

  it("returns null for values that are not literal oklch colors", () => {
    for (const value of [
      "var(--primary)",
      "#a8454b",
      "rgb(1 2 3)",
      "",
      "0.5",
    ]) {
      expect(parseOklch(value), value).toBeNull();
    }
  });
});

describe("oklchToSrgb", () => {
  it("round-trips the brand accent to its hex", () => {
    // #a8454b is the accent's authoritative definition (see docs/design-system.md);
    // if this drifts, the token no longer paints the brand color.
    expect(oklchToHex({ l: 0.524, c: 0.131, h: 19.1, alpha: 1 })).toBe(
      "#a8454b"
    );
  });

  it("maps achromatic endpoints to white and black", () => {
    expect(oklchToHex(WHITE)).toBe("#ffffff");
    expect(oklchToHex(BLACK)).toBe("#000000");
  });

  it("clamps out-of-gamut channels into 0–1", () => {
    // Far beyond sRGB's red primary.
    for (const channel of oklchToSrgb({ l: 0.6, c: 0.4, h: 19, alpha: 1 })) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });
});

describe("isWithinSrgbGamut", () => {
  it("accepts the shipped accent and rejects an over-saturated red", () => {
    expect(isWithinSrgbGamut({ l: 0.524, c: 0.131, h: 19.1, alpha: 1 })).toBe(
      true
    );
    expect(isWithinSrgbGamut({ l: 0.577, c: 0.4, h: 29, alpha: 1 })).toBe(
      false
    );
  });
});

describe("relativeLuminance", () => {
  it("runs 0 at black to 1 at white", () => {
    expect(relativeLuminance(BLACK)).toBeCloseTo(0, 5);
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 5);
  });
});

describe("contrastRatio", () => {
  it("returns WCAG's 21:1 maximum for black on white", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 2);
  });

  it("returns 1 for a color against itself", () => {
    expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 5);
  });

  it("is order-independent", () => {
    const a: Oklch = { l: 0.524, c: 0.131, h: 19.1, alpha: 1 };
    expect(contrastRatio(a, WHITE)).toBeCloseTo(contrastRatio(WHITE, a), 10);
  });

  it("matches a known reference pair", () => {
    // #a8454b on white measures 5.8:1 in external checkers (issue #84).
    expect(
      contrastRatio({ l: 0.524, c: 0.131, h: 19.1, alpha: 1 }, WHITE)
    ).toBeCloseTo(5.8, 1);
  });
});
