import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { parseOklch } from "./oklch";

const repoRoot = join(__dirname, "..", "..");
const scannedRoots = ["app", "components", "lib"];
/** The one file allowed to define raw colors (see docs/design-system.md). */
const tokenSource = join("app", "globals.css");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx", ".css"].includes(extname(path)) ? [path] : [];
  });
}

const files = scannedRoots
  .flatMap((root) => sourceFiles(join(repoRoot, root)))
  .map((path) => relative(repoRoot, path))
  .filter((path) => !path.endsWith(".test.ts") && !path.endsWith(".test.tsx"));

/**
 * A Tailwind arbitrary value carrying a literal color — `bg-[#a8454b]`,
 * `text-[rgb(0,0,0)]`, `border-[oklch(0.5_0.1_20)]`. Requires a utility prefix
 * and forbids whitespace inside the brackets, which is what a real arbitrary
 * value looks like (Tailwind spells spaces `_`); that keeps ordinary array
 * literals and prose like tokens.ts's "#a8454b" out of the match.
 *
 * Deliberately does *not* match `bg-[color-mix(in_oklch,var(--primary),…)]`:
 * that is built from tokens, and `in_oklch` is a color space, not a literal.
 */
const ARBITRARY_LITERAL_COLOR =
  /\b[a-z][a-z-]*-\[[^\]\s]*(?:#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\([\d.]|\boklab\([-\d.])[^\]\s]*\]/gi;

/** A `--track-stream…:` custom-property declaration — the sole purple exemption (issue #104). */
const STREAM_TOKEN_DECLARATION = /--track-stream[a-z-]*:/;

describe("palette usage across the app", () => {
  it("scans a meaningful number of source files", () => {
    // Guards the guard: a broken walk would make every assertion below vacuous.
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain(tokenSource);
  });

  it("defines raw colors only in app/globals.css", () => {
    const offenders = files
      .filter((path) => path !== tokenSource)
      .flatMap((path) => {
        const matches =
          readFileSync(join(repoRoot, path), "utf-8").match(
            ARBITRARY_LITERAL_COLOR
          ) ?? [];
        return matches.map((match) => `${path}: ${match}`);
      });
    expect(offenders).toEqual([]);
  });

  it("has no purple left anywhere in the app", () => {
    // The retired accent sat at hue ~300 (issue #84). Catches both literal
    // oklch values and any lingering `purple`/`violet` utility class.
    //
    // The one exemption is the stream track (issue #104), which *is* Twitch
    // purple by design. It's scoped as narrowly as it can be: a line in
    // `app/globals.css` that declares a `--track-stream*` token. Purple
    // anywhere else — including any other token in that same file — still
    // fails, which is the point of keeping the guard rather than deleting it.
    const offenders = files.flatMap((path) => {
      const source = readFileSync(join(repoRoot, path), "utf-8");
      const scannable =
        path === tokenSource
          ? source
              .split("\n")
              .filter((line) => !STREAM_TOKEN_DECLARATION.test(line))
              .join("\n")
          : source;
      const purpleOklch = [...scannable.matchAll(/oklch\([^)]*\)/g)]
        .map((match) => match[0])
        .filter((raw) => {
          const color = parseOklch(raw);
          return (
            color !== null && color.c > 0.01 && color.h > 270 && color.h < 330
          );
        });
      const purpleUtility =
        source.match(/\b(?:bg|text|border|ring)-(?:purple|violet|fuchsia)-/g) ??
        [];
      return [...purpleOklch, ...purpleUtility].map(
        (match) => `${path}: ${match}`
      );
    });
    expect(offenders).toEqual([]);
  });

  it("keeps banning purple in globals.css outside the stream tokens", () => {
    // Guards the exemption itself: the filter must key on the declared token
    // name, not merely on the file, or #84's ban would be gone from the one
    // file that defines every color.
    const source = readFileSync(join(repoRoot, tokenSource), "utf-8");
    const streamLines = source
      .split("\n")
      .filter((line) => STREAM_TOKEN_DECLARATION.test(line));

    // Three tokens, light and dark.
    expect(streamLines).toHaveLength(6);
    for (const line of streamLines) {
      const color = parseOklch(line.split(":")[1].trim().replace(";", ""));
      expect(color, line).not.toBeNull();
      expect(color!.h, line).toBeGreaterThan(270);
      expect(color!.h, line).toBeLessThan(330);
    }

    // A purple smuggled onto any other token still trips the scan.
    const tampered = source.replace(
      "--track-content: oklch(0.94 0.028 19.1);",
      "--track-content: oklch(0.94 0.028 300);"
    );
    const stillCaught = tampered
      .split("\n")
      .filter((line) => !STREAM_TOKEN_DECLARATION.test(line))
      .join("\n")
      .match(/oklch\([\d.]+ [\d.]+ 300\)/);
    expect(stillCaught).not.toBeNull();
  });
});
