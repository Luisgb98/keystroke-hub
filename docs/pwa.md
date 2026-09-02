# Installable app (PWA)

Keystroke Hub installs to an iPhone home screen or an Android launcher and
opens standalone — its own icon, its own window, no browser chrome. Issue #114.

The owner uses the app on a phone all day, so "mobile-first" has to include the
part before the app opens: what the icon looks like, what the splash screen
does, and whether Safari's toolbar is still in the way afterwards.

## What makes it installable

| Piece                    | Where                                              |
| ------------------------ | -------------------------------------------------- |
| Web app manifest         | `app/manifest.ts` → `/manifest.webmanifest`        |
| Icons (192 / 512 / 180)  | `public/icon-*.png`, `public/apple-touch-icon.png` |
| Apple web-app meta tags  | `metadata.appleWebApp` in `app/layout.tsx`         |
| Theme color + safe areas | `export const viewport` in `app/layout.tsx`        |
| Colors and copy          | `lib/brand.ts`                                     |

**`app/manifest.ts`** is a `MetadataRoute.Manifest` route: name, `start_url`
`/`, `display: "standalone"`, a stable `id`, the brand accent as `theme_color`
and the light background as `background_color`, plus the 192 and 512 icons
Chrome requires and a `maskable` variant for Android's launcher crop.

**`viewport.viewportFit: "cover"`** is load-bearing well beyond installability:
without it, every `env(safe-area-inset-*)` in the app resolves to `0` on a
notched iPhone. The bottom nav's safe-area padding had been silently doing
nothing until this landed.

**`viewport.themeColor`** carries light and dark variants of `--background`, so
the browser chrome and the iOS status bar blend into the page. The accent's
turn comes on the splash screen and the launcher tile, via the manifest — the
two are deliberately different colors doing different jobs.

**iOS reads none of the manifest.** `metadata.appleWebApp` is what makes an
added-to-home-screen copy launch without Safari's chrome, and
`metadata.icons.apple` is what points it at a 180×180 icon. Next 16 emits
`appleWebApp.capable` as the standardised `mobile-web-app-capable` rather than
the legacy `apple-` prefixed name; iOS has honoured the unprefixed one since
Safari 15.4.

## Why the manifest isn't behind the session gate

Browsers fetch a manifest and its icons **without credentials**. Gating them
would make the app uninstallable — the fetch would land on a login redirect and
the installer would give up. `proxy.ts`'s matcher already exempts anything with
a file extension, which covers `/manifest.webmanifest` and every `.png`, and
the manifest carries nothing private: a name, a description and four colors.
`e2e/pwa.spec.ts` proves it from a signed-out context so this can't regress.

## The icon set

`pnpm icons:generate` (`scripts/generate-app-icons.mts`) draws the mark — a
white keycap carrying a red **K** on the brand accent — and writes the four
PNGs into `public/`. The output is **committed**, not generated at build time:
a manifest icon has to be a stable URL fetchable without a session, and the
repo has no image pipeline (no `sharp`, no `next/og` route) to produce one at
request time.

The generator is dependency-free on purpose — a rounded-rect and capsule
signed-distance field, 3×3 supersampled, then a hand-rolled PNG encoder over
`node:zlib`. That's less code than an image dependency this repo doesn't
otherwise need, and it keeps the mark defined in geometry rather than in a
binary nobody can diff.

Re-run it and commit the diff whenever the brand accent moves. It reads
`BRAND_COLOR` from `lib/brand.ts`, so it can't drift from the manifest or the
meta tags — and `lib/brand.test.ts` pins that constant against `--primary` in
`app/globals.css`, so the design tokens can't move without the installed app
following.

All four icons are full-bleed and fully opaque. iOS rounds the corners itself,
and a transparent corner would show the launcher's wallpaper through the mark;
the maskable variant simply pulls the keycap further in, inside Android's 80%
safe zone.

## Tests

- **Unit:** `app/manifest.test.ts` (installability fields, splash colors, both
  required sizes plus a maskable one, every icon resolving to a real PNG of the
  size it claims, every `src` carrying an extension so the proxy exempts it);
  `app/layout.test.tsx` (`viewportFit`, per-scheme `themeColor`, the Apple
  tags); `lib/brand.test.ts` (colors match the CSS tokens, short name fits a
  home-screen label); `scripts/generate-app-icons.test.ts` (mark geometry,
  antialiasing, opacity, and a decodable PNG header).
- **e2e (`e2e/pwa.spec.ts`):** the document links the manifest and the Apple
  touch icon; the Apple tags and `viewport-fit=cover` are present; both
  `theme-color` variants render; and — from a signed-out context — the manifest
  and every icon it names are served 200 without a session. No database needed.
