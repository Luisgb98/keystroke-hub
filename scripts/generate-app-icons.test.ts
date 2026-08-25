import { describe, expect, it } from "vitest";

import { BRAND_COLOR } from "@/lib/brand";

import {
  BRAND,
  ICONS,
  encodePng,
  markColorAt,
  renderIcon,
} from "./generate-app-icons.mts";

describe("icon mark", () => {
  const SIZE = 192;
  const CAP = 0.56;
  const centre = SIZE / 2;

  it("fills the corners with the brand accent, so nothing shows through a mask", () => {
    // Every icon is full-bleed: iOS rounds the corners itself, and a
    // transparent corner would show the launcher's wallpaper instead.
    expect(markColorAt(1, 1, SIZE, CAP)).toEqual(BRAND);
    expect(markColorAt(SIZE - 1, SIZE - 1, SIZE, CAP)).toEqual(BRAND);
  });

  it("reads the accent from lib/brand rather than hardcoding it", () => {
    const hex = `#${[BRAND.r, BRAND.g, BRAND.b]
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")}`;
    expect(hex).toBe(BRAND_COLOR);
  });

  it("puts a white keycap between the corners and the letterform", () => {
    // A point inside the cap but clear of every stroke: just right of the
    // upper arm's inner edge, near the cap's top-left.
    const x = centre - SIZE * CAP * 0.32;
    const y = centre - SIZE * CAP * 0.05;
    expect(markColorAt(x, y, SIZE, CAP)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("draws the K's stem in the accent", () => {
    const stemX = centre - SIZE * CAP * 0.2;
    expect(markColorAt(stemX, centre, SIZE, CAP)).toEqual(BRAND);
  });

  it("pulls the mark further in for the maskable variant", () => {
    // Android crops to the launcher's shape, which can eat everything outside
    // the middle 80% — so the maskable cap has to be strictly smaller.
    const maskable = ICONS.find((icon) => icon.file.includes("maskable"));
    const plain = ICONS.find((icon) => icon.file === "icon-512.png");
    expect(maskable!.capScale).toBeLessThan(plain!.capScale);

    // A point the plain cap covers and the maskable one must not.
    const edge = centre + SIZE * 0.26;
    expect(markColorAt(edge, centre, SIZE, 0.56)).not.toEqual(BRAND);
    expect(markColorAt(edge, centre, SIZE, 0.44)).toEqual(BRAND);
  });

  it("antialiases the cap's edge instead of stairstepping it", () => {
    // Supersampling means the boundary pixels are a blend, not one or the
    // other — at 192px an aliased edge is plainly visible on a home screen.
    const pixels = renderIcon(SIZE, CAP);
    const capEdgeX = Math.round(centre - (SIZE * CAP) / 2);
    const offset = (centre * SIZE + capEdgeX) * 4;
    const red = pixels[offset];
    expect(red).toBeGreaterThan(BRAND.r);
    expect(red).toBeLessThan(255);
  });
});

describe("PNG encoder", () => {
  it("writes a decodable 8-bit RGBA PNG of the requested size", () => {
    const size = 16;
    const png = encodePng(renderIcon(size, 0.56), size, size);

    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
    expect(png[24]).toBe(8); // bit depth
    expect(png[25]).toBe(6); // truecolour with alpha
    expect(png.subarray(png.length - 8).toString("ascii")).toContain("IEND");
  });

  it("emits fully opaque pixels", () => {
    const size = 8;
    const pixels = renderIcon(size, 0.56);
    for (let i = 3; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(255);
    }
  });
});

describe("icon set", () => {
  it("covers the four sizes the manifest and iOS ask for", () => {
    expect(ICONS.map((icon) => icon.file)).toEqual([
      "icon-192.png",
      "icon-512.png",
      "icon-maskable-512.png",
      "apple-touch-icon.png",
    ]);
    expect(
      ICONS.find((icon) => icon.file === "apple-touch-icon.png")!.size
    ).toBe(180);
  });
});
