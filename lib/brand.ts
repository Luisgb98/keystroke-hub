/**
 * The app's identity as data — name, description and the colors that have to
 * be literal hex rather than CSS tokens (#114).
 *
 * A web manifest, a `theme-color` meta tag and a PNG icon file can't read
 * `var(--primary)`: they're consumed by the OS installer, the browser chrome
 * and an image encoder respectively, all outside the stylesheet. So the three
 * of them share this module instead of each carrying a copy, and
 * `brand.test.ts` pins these values against `globals.css` so a change to the
 * design tokens can't leave the installed app on last season's colors.
 */

export const APP_NAME = "Keystroke Hub";

/** What fits under a home-screen icon — iOS truncates around 12 characters. */
export const APP_SHORT_NAME = "Keystroke";

export const APP_DESCRIPTION =
  "A single-user hub for a full-stack developer and gaming content creator to run their work life and content creation side by side.";

/** `--primary` in light mode: the brand accent (docs/design-system.md). */
export const BRAND_COLOR = "#a8454b";

/** `--background` in each mode — what the browser chrome should blend into. */
export const APP_BACKGROUND_LIGHT = "#ffffff";
export const APP_BACKGROUND_DARK = "#0a0a0a";
