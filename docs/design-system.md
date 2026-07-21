# Design system

Keystroke Hub's visual language, in one place. The living version is
[`/styleguide`](../app/styleguide/page.tsx) — this document explains the
rules behind it. When the two disagree, the styleguide (reading the real
tokens from `app/globals.css`) is the source of truth.

## Tokens

All colors are defined as CSS custom properties in `app/globals.css`, in
OKLCH, once for `:root` (light) and once for `.dark`. They're exposed to
Tailwind via `@theme inline`, so every token is also a utility class
(`bg-primary`, `text-muted-foreground`, `border-track-work-border`, …).

Never hardcode a color. If a component needs a color that isn't a token yet,
add the token first.

## Dual-track colors

Keystroke Hub renders two strictly separate worlds — **work** and
**content** — sometimes side by side (the shared calendar, an agenda, a
dashboard). Any component that renders an item from either world must use
only the track tokens, never a raw or semantic color:

| Token                                                          | Purpose                         |
| -------------------------------------------------------------- | ------------------------------- |
| `bg-track-work` / `bg-track-content`                           | Surface for a work/content item |
| `text-track-work-foreground` / `text-track-content-foreground` | Text on that surface            |
| `border-track-work-border` / `border-track-content-border`     | Border/outline for that surface |

Both palettes hold WCAG AA contrast (surface vs. foreground) in both themes —
verify any new pairing on the Colors section of `/styleguide`.

**Color is never the only signal.** Every track-colored element pairs the
color with an icon (`Briefcase` for work, `Clapperboard` for content) and a
text label, so the distinction survives grayscale, color blindness, or a
screenshot. See `components/styleguide/dual-track-showcase.tsx` for the
reference pattern.

## Typography

A constrained scale, exposed as `text-*` utilities with paired line-heights:
`display`, `h1`, `h2`, `h3`, `body`, `small`, `caption`. Display/h1/h2 are
fluid (`clamp()`) so they scale from mobile to desktop without a breakpoint.

Font weight is not baked into the scale — pair a size with a `font-*`
utility (usually `font-semibold` for headings, default weight for body).
Headings use `font-heading` (display typeface); everything else defaults to
`font-sans` (body typeface) via `<html>`.

## Fonts

- **Bricolage Grotesque** — display/heading typeface. Expressive, used
  sparingly (headings only).
- **Inter** — body typeface. Neutral, highly legible at small sizes.
- **JetBrains Mono** — the "keystroke" identity thread: timestamps, labels,
  kbd-style chips, code. Not just a fallback mono — an intentional accent.

All three are loaded via `next/font/google` in `app/layout.tsx` (self-hosted,
zero layout shift, no external requests).

## Spacing & radii

Spacing uses Tailwind's default scale as-is. Radii are derived from one
`--radius` base (`radius-sm` → `radius-4xl`); don't introduce a one-off
radius value in a component.

## Elevation

`shadow-xs` → `shadow-lg`, driven by a single `--shadow-color` token. In dark
mode, shadows read poorly against dark surfaces, so `--shadow-color` becomes
more transparent there and components should lean more on `border` /
`ring-1 ring-border` than on shadow depth to communicate elevation.

## Motion

Three durations (`duration-motion-fast/base/slow`) and two easings
(`ease-motion-standard`, `ease-motion-emphasized`). Keep motion restrained —
these are for micro-interactions (hover, open/close), not scene transitions.
All three durations collapse to `0ms` under `prefers-reduced-motion: reduce`
— never bypass this by hardcoding a duration outside the tokens.

## Dark / light mode

Handled by `next-themes` (`ThemeProvider` in `app/layout.tsx`), class-based
(`.dark` via `@custom-variant dark`), defaulting to system preference and
persisting the user's explicit choice. `suppressHydrationWarning` is set on
`<html>` per next-themes' recommendation, so there's no flash on load.

## Adding a component

1. Reach for `pnpm dlx shadcn@latest add <component>` first — it already
   consumes our tokens.
2. If you hand-write a component, use only token utilities (no raw hex/oklch,
   no arbitrary color values).
3. Add it to the Components section of `/styleguide` so it stays checkable
   against regressions.
