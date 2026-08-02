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

Every token ships **inside the sRGB gamut**, so what the CSS declares is what
the browser paints — no silent gamut-mapping between the value in
`globals.css` and the pixel. `app/globals.css.test.ts` guards this, along with
the hue families and the WCAG AA contrast of each changed pair.

## The accent, and the three reds

The brand accent is **`#a8454b`** — `oklch(0.524 0.131 19.1)`, a muted brick
red. Dark mode lifts the same hue to `oklch(0.72 0.14 19.1)`; `#a8454b` is too
dark to read on a dark surface. `--sidebar-primary` and the focus rings
(`--ring`, `--sidebar-ring`) are derived from it, so buttons, badges, links,
the sidebar active bar, the mobile bottom-nav dot, the inbox count badge and
every focus halo all come from one decision.

That leaves three reds in the palette, kept apart on purpose:

| Token             | Light                     | Role                                           |
| ----------------- | ------------------------- | ---------------------------------------------- |
| `--primary`       | `oklch(0.524 0.131 19.1)` | The accent. Muted, low chroma.                 |
| `--destructive`   | `oklch(0.577 0.215 29)`   | Alarm. ~1.6× the chroma, hue shifted +10.      |
| `--track-content` | `oklch(0.94 0.028 19.1)`  | Content-track surface. Accent hue, tint level. |

Two rules keep them legible as different things:

1. **Destructive is never a solid fill.** It stays a tint with colored text
   (`bg-destructive/10 text-destructive`) while `default` is a solid
   `bg-primary`. The difference is structural, not just chromatic, so "delete"
   can't be mistaken for the default action.
2. **Nothing else uses a primary tint.** Because `bg-primary/10 text-primary`
   now looks like the destructive treatment, selected states use a _solid_
   accent fill instead — see `MoodPicker` and `WeekRatingPicker`.

The content track sits at the accent's hue but well below its chroma, so
chips and hovers stay subordinate to buttons. The work track stays blue
(~250–255): the two tracks must never converge.

## Buttons

`components/ui/button.tsx` is the single button system — six variants
(`default`, `outline`, `secondary`, `ghost`, `destructive`, `link`), each with
a deliberate hover, pressed and focus state. Don't hand-roll a `<button>` with
its own surface classes; reach for `Button` and override only what's genuinely
different (see the format radios in `components/content/idea-editor.tsx`,
which keep the shared geometry and focus ring but take a track-colored checked
state).

Filled variants move toward `--foreground` on hover and press
(`color-mix(in oklch, var(--primary), var(--foreground) 14%)`) rather than
stepping down in alpha. An alpha step lightens a solid accent against the page
and reads as _disabled_; mixing toward the foreground darkens in light mode and
lightens in dark mode, so the button deepens under the cursor in both themes.

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

## Dates & times

No native `<input type="date">`/`type="time"` anywhere (#86) — their popovers
are unthemed, OS-dependent white surfaces. Use `DatePicker` and `TimePicker`
(`components/ui/`) instead:

- Both are a typed field plus a themed popover (a `Calendar` for days, a list
  of times on a 30-minute grid). Typing is never restricted to what the popover
  offers, so keyboard entry stays as fast as the native control was.
- The visible input carries `name`, so inside a `<form action>` it serializes
  exactly the `yyyy-MM-dd` / `HH:mm` string the zod schemas already expect —
  no hidden mirror field.
- Controlled (`value`/`onChange`) and uncontrolled (`defaultValue`) both work.
- Convert with the exported `parseDateValue`/`formatDateValue`, never
  `new Date("yyyy-MM-dd")` or `toISOString()` — those go through UTC and shift
  the day west of Greenwich.
- `triggerLabel` names the popover button and must be unique on the page. It
  must also not _contain_ the field's own label as a substring: Playwright's
  `getByLabel` matches substrings, so an "Open release date calendar" trigger
  beside a "Release date" field makes every `getByLabel("Release date")` in the
  e2e suite ambiguous. Reword the trigger ("Open publish day calendar") rather
  than adding `exact: true` to the specs.

The `color-scheme` declarations in `app/globals.css` stay — they still theme
native scrollbars and autofill.

## Dark / light mode

Handled by `next-themes` (`ThemeProvider` in `app/layout.tsx`), class-based
(`.dark` via `@custom-variant dark`), defaulting to system preference and
persisting the user's explicit choice. `suppressHydrationWarning` is set on
`<html>` per next-themes' recommendation, so there's no flash on load.

## Dialogs and long strings (#102)

`DialogContent` is a `grid` with a `max-w-*` cap, and a grid item's
`min-width: auto` floors it at its own min-content width. One long unbreakable
string deep inside therefore used to win against the cap: a linked idea titled
"Path of Exile 3.29: la build de invocador con la que empiezo la liga" pushed
`EventEditor`'s form to 726px inside a 448px panel, so the track picker, title
field, End date/time and footer all painted on the page _outside_ the white box.

Two rules follow:

- `DialogContent` carries `[&>*]:min-w-0`, which zeroes that floor on its direct
  children and makes `max-w-*` authoritative for every dialog.
- Any flex item that holds text meant to `truncate` needs `min-w-0` itself —
  `overflow-hidden` and `flex-1` are not enough. Without it the item reports its
  full unwrapped width as its minimum and the ellipsis never appears.

`IdeaEditor` never showed this despite the same shape, because
`overflow-y-auto` makes it a scroll container, which zeroes the floor as a side
effect. Don't rely on that — it's incidental.

## Dialogs that close on a server action (#102)

A dialog whose close depends on a mutation's result must **not** drive that
close off `useActionState`'s state. That state commits only once the router has
applied the refresh the action's `revalidatePath` calls trigger, so the close
waits on a full page re-render, not on the mutation. `IdeaEditor` sat on a
disabled "Saving…" for 20s+ this way while the row had already landed in ~300ms
— a modal the user could not dismiss after a save that had already succeeded.

Instead: `useTransition`, `await` the action directly, and act on the result
inside the transition callback (`TriageDialog`, `RecordOutcomeDialog`,
`AttachPicker`, `IdeaEditor`). That settles on the server response, and a
transition callback is an ordinary post-event context — so it is also the only
legal place to call a parent's `onOpenChange`. Doing that during render earns
React's "Cannot update a component while rendering a different component".

The cost scales with the **revalidated route's** own render cost, which is why
only the ideas page crossed the line — `/content/ideas` runs two sequential
waves of queries (ideas + tags + scripts, then linked events + projects).
Measured close latency for the dialogs still on `useActionState`, cold server,
12 runs: `EventEditor` 341–849ms, inbox `CaptureDialog` 436–461ms,
`StreamCreate` 442–952ms. None hangs today, so none was rewritten; they are
about one heavier page-level query away from doing so. Write new dialogs the
transition way.

## Adding a component

1. Reach for `pnpm dlx shadcn@latest add <component>` first — it already
   consumes our tokens.
2. If you hand-write a component, use only token utilities (no raw hex/oklch,
   no arbitrary color values).
3. Add it to the Components section of `/styleguide` so it stays checkable
   against regressions.
