# Mobile shell

"Mobile-first, fully usable on desktop" is a stated non-negotiable of this
project, and the phone is where the owner actually uses the app — capturing
ideas, checking the calendar, logging the journal. Issue #114 closed the gap
between that claim and the bottom of the screen.

Installability (manifest, icons, safe areas) lives in
[`docs/pwa.md`](pwa.md).

## The bottom bar: five slots, no more

`components/shell/bottom-nav.tsx` renders **four destinations plus "More"**:
Dashboard, Calendar, Content, Journal, More.

It used to render nine — the five `navItems`, Inbox (#85), the palette Search
button, Settings and Sign out. At 375px that left ~42px per slot, so every
label wrapped across up to three lines ("Dashb oard", "Projec ts & Meeti ngs")
and the bar grew to roughly twice a tab bar's height, eating the page.

Five is the ceiling a tab bar can hold before that starts happening again, and
it's what makes the current geometry affordable: a fixed `4rem` row, one
`text-caption` line per label, `flex-1 min-w-0` so all five slots are identical
and no long label can push its neighbours out. At 390px each slot is ~78px
wide; even at 320px it's ~64px, which "Dashboard" clears at the type scale's
smallest step. A label that ever did overflow truncates rather than wrapping —
a wrap would mean a bug, not a tight fit.

`components/shell/bottom-nav-styles.ts` holds that geometry as plain exported
class strings, including the matching `pb-` for the app's scrollport. It's a
plain module (not `"use client"`) because the sign-out form is a server
component and can't import a constant out of one — the same reason it existed
before #114. Two things that have to be the same number now come from one
place: the bar's height and `<main>`'s bottom padding in `app/(app)/layout.tsx`.

The safe-area inset is added **on top of** the `4rem` row rather than padded
into it, so the tappable row keeps its full height on a notched iPhone. That
inset only resolves to something non-zero because of `viewportFit: "cover"` —
see `docs/pwa.md`.

## What's behind "More"

`components/shell/more-sheet.tsx` opens a bottom sheet listing everything that
lost (or never had) a bar slot: **Projects & Meetings**, **Inbox**,
**Settings**, **Search** (opens the command palette) and **Sign out**. Every
one of them is one tap from the bar, which is what the "nothing becomes
unreachable" acceptance criterion actually requires.

- The trigger is highlighted whenever the active route lives behind it
  (`isMoreNavActive`) — otherwise the bar would look like nothing is selected
  while you're on `/projects`.
- The untriaged inbox count is mirrored on the trigger as a **dot**, not a
  number: `docs/inbox.md` promises the count stays visible on mobile at all
  times, and the Inbox tab that used to carry it now sits inside the sheet. The
  number itself is on the Inbox row, one tap in.
- Tapping Search closes the sheet **before** opening the palette. Two stacked
  modals would fight over the focus trap, and the palette is the one that
  should win.
- Tapping a destination closes the sheet, rather than leaving it covering the
  page the tap just asked for.

`lib/navigation.ts` is the single source of truth for the split:
`bottomNavItems` (the four slots, drawn from the same objects as `navItems`, so
a relabelled item can't say one thing in the sidebar and another in the bar)
and `moreNavItems` (the sheet's destinations, including the shared
`inboxNavItem` and `settingsNavItem` the sidebar renders too). A unit test
asserts every `navItems` entry is reachable from one list or the other, so a
sixth destination can't be added and quietly lost.

The **sidebar is unchanged**: it has room for all five, so desktop keeps the
flat list.

## `components/ui/sheet.tsx`

A bottom-anchored `Dialog`: the same Base UI primitive as `dialog.tsx` — so
focus trapping, scroll locking and Esc behave identically to every other modal
— docked to the bottom edge, capped at `85svh` with an internal scroll, and
padded past the home indicator. `svh` rather than `vh` so a mobile browser's
collapsing toolbar can't push the bottom of the sheet off-screen.

## Dialogs: bottom sheets on a phone

`DialogContent` takes a `variant`:

- **`"centered"`** (default) — a centred panel at every width. Right for short,
  glanceable content: a confirmation, a picker, a one-field prompt. Every
  `AlertDialog` stays here too; a centred alert is the native shape on a phone
  as much as on a desktop.
- **`"sheet"`** — a bottom sheet below `md`, the same centred panel from `md`
  up. Every form-shaped dialog uses it: the event editor, the idea editor
  (create and edit), stream create, inbox capture, triage, record outcome, the
  publish checklist, the default-checklist editor and the shared attach picker.

The switch is **pure CSS** — one DOM tree, no breakpoint hook — so nothing can
mismatch between the server render and the hydrated one, and nothing re-mounts
when a tablet rotates.

Pair it with **`DialogBody`**, which is the part that scrolls. Header and
footer are `shrink-0`; the body is `flex-1 min-h-0 overflow-y-auto`. That's
what keeps Save reachable: before #114 the whole panel scrolled, so at 390px
the idea editor opened with its Save button below the fold and scrolling to it
took the title off the top of the screen. Now the fields move and the two
anchors don't.

Two details that look fussy and aren't:

- The cap is **`92svh`, not `dvh`**. A mobile browser's collapsing toolbar
  changes `dvh` mid-scroll, which is exactly enough to push a pinned footer
  off-screen.
- **`DialogFooter` carries the home-indicator inset itself** in a sheet
  (`group-data-[variant=sheet]`), so its own surface fills the safe area
  instead of leaving a bare strip under it. Scoped to the variant, because a
  centred dialog isn't at the bottom edge and would just grow a phantom gap.

## Touch targets

The audit that opened #114 found almost nothing in the app clearing Apple's
44px minimum on a 390px screen: fields were 32px, buttons 28–32px, the
date-picker trigger 24px. Rather than patch call sites, the **shared primitives
grow below `md` and collapse back to the desktop scale from `md` up** —
`Button` (every size), `Input`, `SelectTrigger`, `InputGroup` and `TabsList`.
The dense desktop design is unchanged.

iOS focus zoom was already handled: `Input` and `Textarea` render `text-base`
below `md`. `SelectTrigger` joined them — Safari zooms the page whenever a
focused field computes under 16px.

A handful of controls stay under the bar deliberately, and
`e2e/mobile-audit.spec.ts` names each one rather than lowering the threshold to
whatever currently passes:

| Exception                             | Why                                                                                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Inline text links                     | WCAG 2.5.8 exempts them outright — padding an inline link to 44px breaks the line box it lives in.                                           |
| Month-grid chips and add-buttons      | Seven columns out of 390px is a ~52px cell; a 44px control leaves no cell to put it in. The day itself opens the full day view.              |
| Calendar / clock popover triggers     | They sit _inside_ a 44px field whose typed input is the primary target; a taller button spills out of it.                                    |
| `size="xs"` chips                     | The inline-chip size, used inside rows of text where a 44px control would out-shout the content it belongs to. Still 24px → 36px on a phone. |
| The scheduled-event chip's unlink "×" | A secondary action inside a chip that is itself a 44px target.                                                                               |

Two hover-only affordances got touch equivalents: the month cell's **add-event
button** is permanently visible below `md` (it was `opacity-0
group-hover:opacity-100`, so on touch the only way to use it was to tap an
invisible 24px target), and the week agenda's event chips grow to 44px, where
the full-width rows have room for it.

Elsewhere: the shell's scrollport gets `overscroll-y-contain`, so a rubber-band
at the top can't hand the gesture to the browser and fire pull-to-refresh over
a viewport-locked page; and the journal's day header reorders so the long date
takes its own row on a phone instead of wrapping mid-date.

## The `iphone` Playwright project

`playwright.config.ts` gains a third project on `devices["iPhone 14"]` — a real
390×844 phone viewport with touch input. `browserName` is pinned to `chromium`
on purpose: the device preset defaults to WebKit and CI installs chromium only,
so what's wanted here is the viewport, not a second rendering engine.

It runs a **curated, read-only subset**: `mobile-audit`, `shell-navigation` and
`pwa`. Every other mobile-viewport check in the suite writes real rows and
already runs its own `test.use`-scoped mobile describe under `chromium` —
running those again here would race the shared development database, which is
the same reason `mobile-chrome` carries its long `testIgnore`.

`e2e/mobile-audit.spec.ts` is the standing contract: for all sixteen primary
pages, no horizontal scroll and no undersized control outside the named
exceptions; for four form dialogs, docked to the bottom edge at full width with
the submit button already in the viewport; plus a long-form scroll check (the
header and Save stay put while the fields move) and a sweep proving no text
field computes under 16px.

## Tests

- **Unit:** `lib/navigation.test.ts` (four bar slots, every primary destination
  reachable, shared object identity, `isMoreNavActive` including nested
  routes); `bottom-nav.test.tsx` (exactly five slots, the moved destinations
  absent from the bar, the dot mirrored and silent at inbox zero, More
  highlighted for a route behind it); `more-sheet.test.tsx` (contents closed by
  default, every moved destination reachable with the right href, Search and
  Sign out present, the sheet closing before the palette opens and on
  navigation, the count on the Inbox row and in its accessible name);
  `nav-link.test.tsx` (the bottom variant's shared geometry, and that it takes
  no badge); `ui/sheet.test.tsx` (opens from its trigger, closes on Escape,
  docks to the bottom edge, decorative handle); `ui/dialog.test.tsx` (the
  variant's docked/centred geometry, `svh` cap, the scroll split across
  header/body/footer, and the footer's safe-area inset scoped to the sheet);
  `ui/button.test.tsx` and `ui/input.test.tsx` (44px below `md`, desktop scale
  from `md` up, 16px text); plus the touch-target and hover-equivalent
  assertions colocated with `month-view`, `day-header`, `idea-filters` and
  `week-rating-picker`.
- **e2e (`e2e/shell-navigation.spec.ts`):** at 390px the bar holds five slots
  inside the viewport with no horizontal overflow, every slot ≥44px tall and
  none taller than the bar; every label measures under 1.5 line-heights; each
  moved destination is reached in one tap and the sheet closes behind it; More
  is highlighted on `/projects`; Search and Sign out are in the sheet. The
  cross-viewport navigation loop iterates `bottomNavItems` rather than all five
  `navItems`, since this file runs under both Playwright projects.
