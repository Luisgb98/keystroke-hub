import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  APP_BACKGROUND_LIGHT,
  APP_DESCRIPTION,
  APP_NAME,
  BRAND_COLOR,
} from "@/lib/brand";

import manifest from "./manifest";

const result = manifest();

/** Reads a PNG's real pixel dimensions out of its IHDR chunk, which starts at a fixed offset. */
function pngSize(path: string): { width: number; height: number } {
  const file = readFileSync(path);
  expect(file.subarray(0, 8).toString("hex"), `${path} is not a PNG`).toBe(
    "89504e470d0a1a0a"
  );
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

describe("web app manifest", () => {
  it("declares everything Chrome requires to offer an install", () => {
    // Name, start_url, display and a 192 + 512 icon pair are the installability
    // bar; miss one and "Add to Home Screen" degrades to a bookmark (#114).
    expect(result.name).toBe(APP_NAME);
    expect(result.short_name).toBe("Keystroke");
    expect(result.description).toBe(APP_DESCRIPTION);
    expect(result.start_url).toBe("/");
    expect(result.display).toBe("standalone");
  });

  it("opens at the dashboard, inside the app's own scope", () => {
    expect(result.start_url).toBe("/");
    expect(result.scope).toBe("/");
  });

  it("keeps a stable id so an update never installs a second app", () => {
    expect(result.id).toBe("/");
  });

  it("paints the splash from the design tokens", () => {
    expect(result.background_color).toBe(APP_BACKGROUND_LIGHT);
    expect(result.theme_color).toBe(BRAND_COLOR);
  });

  it("ships both required icon sizes plus a maskable variant", () => {
    const sizes = result.icons?.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(result.icons?.some((icon) => icon.purpose === "maskable")).toBe(
      true
    );
  });

  it("points every icon at a real PNG of the size it claims", () => {
    // A manifest that names a missing or mis-sized file still parses — and
    // still fails to install. `pnpm icons:generate` writes these.
    for (const icon of result.icons ?? []) {
      const path = join(process.cwd(), "public", icon.src);
      const [width, height] = (icon.sizes ?? "").split("x").map(Number);
      expect(pngSize(path), icon.src).toEqual({ width, height });
    }
  });

  it("keeps its icons out of the session gate", () => {
    // `proxy.ts` exempts anything with a file extension. Browsers fetch the
    // manifest and its icons without credentials, so a `.png`-less icon path
    // would redirect to /login and quietly break installability.
    for (const icon of result.icons ?? []) {
      expect(icon.src, icon.src).toMatch(/^\/[\w-]+\.png$/);
    }
  });
});
