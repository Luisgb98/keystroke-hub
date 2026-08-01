/**
 * The app's single source of truth for "what wall clock does the owner mean?"
 *
 * Keystroke Hub is a single-user app, so every date/time in it is expressed in
 * one timezone rather than in whatever zone the machine rendering it happens
 * to run in. Without this, `new Date("2026-08-01T19:00:00")` means 19:00 in
 * Madrid during local dev and 19:00 UTC on Vercel — the +2h save shift in
 * issue #95.
 *
 * ## Why `NEXT_PUBLIC_`
 *
 * The calendar views are SSR'd **client** components: every time label is
 * rendered once on the server and again in the browser, and React requires
 * both passes to produce identical HTML. A server-only env var would leave the
 * browser pass guessing, so the value has to be readable on both sides — which
 * for Next means a `NEXT_PUBLIC_` var inlined at build time. Build-time and
 * runtime env are the same deployment on Vercel, so the two passes can never
 * disagree.
 */

/** Used when `NEXT_PUBLIC_APP_TIMEZONE` is unset — the owner's home zone. */
export const DEFAULT_APP_TIMEZONE = "Europe/Madrid";

/**
 * The IANA timezone every stored instant is parsed from and formatted back
 * into. Read as a full static member expression so Next inlines it into the
 * client bundle.
 */
export const APP_TIMEZONE =
  process.env.NEXT_PUBLIC_APP_TIMEZONE?.trim() || DEFAULT_APP_TIMEZONE;
