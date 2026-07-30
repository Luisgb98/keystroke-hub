/**
 * A minimal OKLCH → sRGB path, enough to check the palette in `app/globals.css`
 * against WCAG contrast ratios and the sRGB gamut without pulling in a color
 * library. Pure functions, no dependencies — see docs/design-system.md.
 */

export interface Oklch {
  /** Perceptual lightness, 0–1. */
  l: number;
  /** Chroma, 0–~0.4 in sRGB. */
  c: number;
  /** Hue angle in degrees. */
  h: number;
  /** Alpha, 0–1. Defaults to 1. */
  alpha: number;
}

/** Linear-light sRGB, unclamped — components outside 0–1 are out of gamut. */
export type LinearRgb = [r: number, g: number, b: number];

const OKLCH_PATTERN =
  /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i;

/** `12%` → 0.12, `0.524` → 0.524. */
function parseNumberOrPercent(raw: string): number {
  return raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
}

/**
 * Parses an `oklch(L C H)` / `oklch(L C H / A)` string, with L and A allowed as
 * percentages. Returns `null` for anything else (including `var()` refs).
 */
export function parseOklch(value: string): Oklch | null {
  const match = OKLCH_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, l, c, h, alpha] = match;
  const parsed: Oklch = {
    l: parseNumberOrPercent(l),
    c: parseNumberOrPercent(c),
    h: Number(h),
    alpha: alpha === undefined ? 1 : parseNumberOrPercent(alpha),
  };
  return Number.isFinite(parsed.l) &&
    Number.isFinite(parsed.c) &&
    Number.isFinite(parsed.h) &&
    Number.isFinite(parsed.alpha)
    ? parsed
    : null;
}

/** OKLCH → linear-light sRGB, via OKLab and the LMS cone response. */
export function oklchToLinearRgb({ l, c, h }: Oklch): LinearRgb {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);

  const lCone = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mCone = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sCone = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * lCone - 3.3077115913 * mCone + 0.2309699292 * sCone,
    -1.2684380046 * lCone + 2.6097574011 * mCone - 0.3413193965 * sCone,
    -0.0041960863 * lCone - 0.7034186147 * mCone + 1.707614701 * sCone,
  ];
}

function encodeGamma(channel: number): number {
  return channel <= 0.0031308
    ? 12.92 * channel
    : 1.055 * channel ** (1 / 2.4) - 0.055;
}

function decodeGamma(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Gamma-encoded sRGB, each channel clamped to 0–1. */
export function oklchToSrgb(color: Oklch): [number, number, number] {
  return oklchToLinearRgb(color).map((channel) =>
    Math.min(1, Math.max(0, encodeGamma(channel)))
  ) as [number, number, number];
}

/** `#rrggbb`, for readable assertion failures. */
export function oklchToHex(color: Oklch): string {
  return `#${oklchToSrgb(color)
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

/**
 * Whether the color survives the trip to sRGB unchanged. Out-of-gamut values
 * still render — browsers gamut-map them — but then the painted color is no
 * longer the one declared, which quietly invalidates any contrast check.
 */
export function isWithinSrgbGamut(color: Oklch, epsilon = 0.0005): boolean {
  return oklchToLinearRgb(color)
    .map(encodeGamma)
    .every((channel) => channel >= -epsilon && channel <= 1 + epsilon);
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(color: Oklch): number {
  const [r, g, b] = oklchToSrgb(color).map(decodeGamma);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, 1–21. Order-independent. */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x
  );
  return (lighter + 0.05) / (darker + 0.05);
}
