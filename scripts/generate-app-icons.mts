#!/usr/bin/env node
// Generates the PWA icon set into `public/` (issue #114).
//
// Usage:
//   pnpm icons:generate
//
// The output is committed, not built on the fly: a manifest icon has to be a
// stable URL that Chrome and iOS can fetch without a session, and the app has
// no image pipeline (no sharp, no `next/og` route) to produce one at request
// time. So the mark is drawn here, analytically, and the PNGs are checked in —
// re-run this whenever the brand accent moves and commit the diff.
//
// Everything below is dependency-free on purpose: a rounded-rect and capsule
// signed-distance field, 3x3 supersampled, then a hand-rolled PNG encoder over
// `node:zlib`. That's less code than it sounds like, and it keeps a build-time
// image dependency out of a repo that doesn't otherwise need one.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { BRAND_COLOR } from "../lib/brand.ts";

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

/** The brand accent — read from `lib/brand.ts` so the icon can't drift from the manifest and the meta tags. */
export const BRAND = hexToRgb(BRAND_COLOR);
const WHITE: Rgb = { r: 0xff, g: 0xff, b: 0xff };

/** Distance from `p` to a rounded rectangle centred at `c`, negative inside. */
function roundedRectDistance(
  px: number,
  py: number,
  cx: number,
  cy: number,
  half: number,
  radius: number
): number {
  const qx = Math.abs(px - cx) - (half - radius);
  const qy = Math.abs(py - cy) - (half - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Distance from `p` to a round-capped segment, negative inside — one stroke of the letterform. */
function capsuleDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  thickness: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const lengthSq = abx * abx + aby * aby;
  const t =
    lengthSq === 0
      ? 0
      : Math.min(1, Math.max(0, (apx * abx + apy * aby) / lengthSq));
  return Math.hypot(apx - abx * t, apy - aby * t) - thickness / 2;
}

/**
 * The mark: a white keycap on the brand accent, carrying a red "K".
 *
 * `capScale` is the keycap's side as a fraction of the canvas. Maskable icons
 * pass a smaller one so the whole mark survives Android's circular crop, which
 * can eat everything outside the middle 80%.
 */
export function markColorAt(
  x: number,
  y: number,
  size: number,
  capScale: number
): Rgb {
  const centre = size / 2;
  const cap = size * capScale;
  const capHalf = cap / 2;

  if (roundedRectDistance(x, y, centre, centre, capHalf, cap * 0.22) > 0) {
    return BRAND;
  }

  // Letterform, in keycap-relative units so it scales with the cap.
  const stemX = centre - cap * 0.2;
  const armX = centre + cap * 0.22;
  const top = centre - cap * 0.31;
  const bottom = centre + cap * 0.31;
  const stroke = cap * 0.13;
  const joint = stemX + stroke * 0.2;

  const inLetter =
    Math.min(
      capsuleDistance(x, y, stemX, top, stemX, bottom, stroke),
      capsuleDistance(x, y, joint, centre, armX, top, stroke),
      capsuleDistance(x, y, joint, centre, armX, bottom, stroke)
    ) <= 0;

  return inLetter ? BRAND : WHITE;
}

/** Supersampling factor per axis — 9 samples a pixel, enough to hide the stairstepping at 192px. */
const SAMPLES = 3;

/** Renders the mark as raw RGBA. Opaque throughout: every icon is full-bleed, so iOS and Android both get a square they can mask themselves. */
export function renderIcon(size: number, capScale: number): Uint8Array {
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const color = markColorAt(
            x + (sx + 0.5) / SAMPLES,
            y + (sy + 0.5) / SAMPLES,
            size,
            capScale
          );
          r += color.r;
          g += color.g;
          b += color.b;
        }
      }
      const samples = SAMPLES * SAMPLES;
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(r / samples);
      pixels[offset + 1] = Math.round(g / samples);
      pixels[offset + 2] = Math.round(b / samples);
      pixels[offset + 3] = 255;
    }
  }

  return pixels;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/** Minimal PNG writer: 8-bit RGBA, one IDAT, filter type 0 on every scanline. */
export function encodePng(
  pixels: Uint8Array,
  width: number,
  height: number
): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: truecolour with alpha
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * The set the manifest and the Apple metadata reference. 192 and 512 are the
 * two sizes Chrome requires for installability; the maskable variant pulls the
 * mark inside Android's 80% safe zone; 180 is what iOS reads for
 * `apple-touch-icon`.
 */
export const ICONS = [
  { file: "icon-192.png", size: 192, capScale: 0.56 },
  { file: "icon-512.png", size: 512, capScale: 0.56 },
  { file: "icon-maskable-512.png", size: 512, capScale: 0.44 },
  { file: "apple-touch-icon.png", size: 180, capScale: 0.56 },
] as const;

function main() {
  for (const { file, size, capScale } of ICONS) {
    const png = encodePng(renderIcon(size, capScale), size, size);
    const path = join(process.cwd(), "public", file);
    writeFileSync(path, png);
    console.log(`wrote ${path} (${size}x${size}, ${png.length} bytes)`);
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
