/**
 * The mobile bottom-nav row's shared geometry, in a plain module so every
 * occupant can use it: `NavLink`'s `"bottom"` variant and the "More" sheet's
 * trigger, which is a button rather than a link and would otherwise keep a
 * hand-copied duplicate that could drift. Same pattern as
 * `calendar/track-styles.ts`.
 *
 * The row holds exactly five slots — four destinations plus "More" (#114,
 * see `lib/navigation.ts`). That is what makes a single-line `text-caption`
 * label and a real tap target affordable: at 390px each slot is ~78px wide,
 * and even at 320px ~64px, which "Dashboard" clears at the type scale's
 * smallest step. The nine-slot row this replaced had ~42px per slot and wrapped
 * every label across up to three lines.
 */

/** The bar itself. The safe-area inset is added *on top of* the 4rem row rather than padded into it, so the tappable row keeps its full height on a notched iPhone. */
export const BOTTOM_NAV_BAR_CLASSES =
  "fixed inset-x-0 bottom-0 z-20 flex h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden";

/**
 * The matching bottom padding for the app's scrollport, so the last row of any
 * page clears the bar. Kept next to `BOTTOM_NAV_BAR_CLASSES` because the two
 * numbers have to be the same one — a literal, since Tailwind reads arbitrary
 * values out of the source text and can't follow a shared JS constant.
 */
export const BOTTOM_NAV_SPACER_CLASSES =
  "pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0";

/** One slot in the row — a nav link or the "More" trigger. `flex-1 min-w-0` gives all five identical widths that can't be pushed out by a long label. */
export const BOTTOM_NAV_ITEM_CLASSES =
  "flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-caption font-medium text-muted-foreground transition-colors duration-motion-fast ease-motion-standard";

/** The icon pill inside a bottom-nav item — shared for the same reason. `relative` anchors the inbox count badge to the icon. */
export const BOTTOM_NAV_ICON_CLASSES =
  "relative flex items-center justify-center rounded-lg px-3 py-1 transition-colors duration-motion-fast ease-motion-standard";

/**
 * The label under a bottom-nav item's icon. Single-line by contract: five slots
 * leave enough room that a wrap would signal a bug rather than a tight fit, so
 * an over-long label truncates instead of stealing the row's height (#114).
 */
export const BOTTOM_NAV_LABEL_CLASSES =
  "w-full truncate text-center whitespace-nowrap";

/**
 * One row inside the "More" sheet — nav links, the Search action and the
 * sign-out form all render as the same 44px-tall full-width row. Shared for the
 * same reason as the bar's item classes: the sign-out form is a server
 * component and can't read anything out of a `"use client"` module.
 */
export const MORE_SHEET_ROW_CLASSES =
  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-small font-medium text-foreground transition-colors duration-motion-fast ease-motion-standard hover:bg-secondary active:bg-secondary";
