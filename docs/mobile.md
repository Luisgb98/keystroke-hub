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
  docks to the bottom edge, decorative handle).
- **e2e (`e2e/shell-navigation.spec.ts`):** at 390px the bar holds five slots
  inside the viewport with no horizontal overflow, every slot ≥44px tall and
  none taller than the bar; every label measures under 1.5 line-heights; each
  moved destination is reached in one tap and the sheet closes behind it; More
  is highlighted on `/projects`; Search and Sign out are in the sheet. The
  cross-viewport navigation loop iterates `bottomNavItems` rather than all five
  `navItems`, since this file runs under both Playwright projects.
