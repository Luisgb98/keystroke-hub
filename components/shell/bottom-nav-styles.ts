/**
 * The mobile bottom-nav row's shared geometry, in a plain module so every
 * occupant can use it: nav links and the palette search button (client
 * components) and the sign-out form (a server component, which can't read a
 * constant out of a `"use client"` module) — previously it kept a hand-copied
 * duplicate that could drift. Same pattern as `calendar/track-styles.ts`.
 *
 * Horizontal padding is deliberately tight: the row holds nine items since #85
 * added Inbox, so at 375px each slot is only ~42px wide and a wider icon pill
 * would spill onto its neighbour's.
 */
export const BOTTOM_NAV_ITEM_CLASSES =
  "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1.5 text-caption font-medium text-muted-foreground transition-colors duration-motion-fast ease-motion-standard";

/** The icon pill inside a bottom-nav item — shared for the same reason. */
export const BOTTOM_NAV_ICON_CLASSES =
  "relative flex items-center justify-center rounded-lg px-2 py-1 transition-colors duration-motion-fast ease-motion-standard";

/**
 * The label under a bottom-nav item's icon. `w-full` + `break-words` keep a
 * long single word ("Dashboard", "Settings") inside its own ~42px slot — without
 * them the text overflows and visibly collides with the neighbouring tabs'
 * labels, which the nine-item row made unmissable (#85). The type scale bottoms
 * out at `caption`, so a smaller label isn't an option — a two-line wrap is.
 */
export const BOTTOM_NAV_LABEL_CLASSES =
  "w-full text-center leading-tight break-words text-balance";
