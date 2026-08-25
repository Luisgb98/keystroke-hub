import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { oklchToHex, parseOklch } from "@/lib/color/oklch";

import {
  APP_BACKGROUND_DARK,
  APP_BACKGROUND_LIGHT,
  APP_DESCRIPTION,
  APP_NAME,
  APP_SHORT_NAME,
  BRAND_COLOR,
} from "./brand";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8");

/** Reads one token's literal value out of a `:root` / `.dark` block, as hex. */
function tokenHex(selector: string, token: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `expected a "${selector} {" block`).toBeGreaterThanOrEqual(0);
  const block = css.slice(start, css.indexOf("\n}", start));
  const match = new RegExp(`--${token}:\\s*([^;]+);`).exec(block);
  expect(match, `expected --${token} in ${selector}`).not.toBeNull();
  const color = parseOklch(match![1].trim());
  expect(color, `--${token} is not a literal oklch color`).not.toBeNull();
  return oklchToHex(color!);
}

describe("brand constants", () => {
  // The manifest, the `theme-color` meta tags and the icon PNGs all live
  // outside the stylesheet and can't read `var(--primary)`. These assertions
  // are what stop the installed app from keeping last season's colors after a
  // token change (#114).
  it("carries the same accent as --primary", () => {
    expect(BRAND_COLOR).toBe(tokenHex(":root", "primary"));
  });

  it("carries the same surfaces as --background in both modes", () => {
    expect(APP_BACKGROUND_LIGHT).toBe(tokenHex(":root", "background"));
    expect(APP_BACKGROUND_DARK).toBe(tokenHex(".dark", "background"));
  });

  it("declares every color as a manifest-legal hex string", () => {
    // A web manifest takes CSS colors, but `oklch()` support in installers is
    // uneven — hex is the one form every one of them parses.
    for (const color of [
      BRAND_COLOR,
      APP_BACKGROUND_LIGHT,
      APP_BACKGROUND_DARK,
    ]) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps the short name short enough for a home-screen label", () => {
    // iOS truncates around 12 characters, and a truncated app name on the
    // home screen is exactly the shabbiness this issue is about.
    expect(APP_SHORT_NAME.length).toBeLessThanOrEqual(12);
    expect(APP_NAME.length).toBeGreaterThan(0);
    expect(APP_DESCRIPTION.length).toBeGreaterThan(0);
  });
});
