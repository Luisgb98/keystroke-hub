# Timezone

Keystroke Hub has exactly one clock: the owner's. Every date and time in the
app is parsed from, and formatted back into, a single IANA timezone —
`NEXT_PUBLIC_APP_TIMEZONE`, defaulting to `Europe/Madrid`.

This document exists because getting it wrong is invisible in local dev and
broken in production (issue #95): a developer machine in Madrid parses
`"2026-08-01T19:00:00"` as 19:00 Madrid, and Vercel's UTC servers parse the
same string as 19:00 UTC. Saved times came back two hours late.

## The two rules

1. **Every `Date` is an absolute instant.** Database rows, props crossing the
   server→client boundary, values handed to date-fns — all of them. No `Date`
   in the app carries a "which zone am I?" flag.

2. **Wall-clock meaning is applied only in `lib/time`.** Parsing a
   `yyyy-MM-dd` / `HH:mm` form value into an instant, formatting an instant for
   display, and every day/week/month boundary go through that module with the
   app timezone passed in explicitly.

Anything that reaches for bare `new Date("…T…")`, `date.getHours()`, or
`format(date, …)` without a zone re-introduces the bug.

## Why not `TZDate` everywhere?

[`@date-fns/tz`](https://github.com/date-fns/tz)'s `TZDate` carries its zone
with it, which is tempting — but it does **not** survive React's server→client
serialization. The calendar views are SSR'd client components, so a `TZDate`
prop would render the app zone in the server pass and a plain device-zone
`Date` in the browser pass: a hydration mismatch instead of a fix. `TZDate` is
therefore used only _inside_ `lib/time`, and never crosses a boundary.

For the same reason `APP_TIMEZONE` is a `NEXT_PUBLIC_` variable: both render
passes have to read the same value. Build-time and runtime env are one
deployment on Vercel, so they can't disagree.

## Why not the browser's timezone?

The alternative design — send the device's IANA zone as a hidden form field —
gives device-local behavior when travelling, at the cost of a value that
changes under the app's feet and can't be known during SSR. For a single-user
app whose owner has one home zone, a fixed app timezone is simpler and
strictly more predictable. Change `NEXT_PUBLIC_APP_TIMEZONE` if the home zone
ever moves.

## The helpers

`lib/time` exports the whole vocabulary: `parseAppDate` / `parseAppDateTime`
(strings → instants, returning `null` for nonexistent days like `2026-02-30`),
`formatInAppZone` / `formatAppDateParam` / `formatAppTimeParam` /
`formatAppDateString` (instants → display), `appStartOfDay` / `appEndOfDay` /
`appStartOfWeek` / `appStartOfMonth` / `appAddDays` / `appAddWeeks` /
`appAddMonths` (boundaries and calendar arithmetic), `appIsSameDay` /
`appIsSameMonth` / `appIsSameYear`, and `appWallClock` /
`appMinutesSinceMidnight` for reading wall-clock parts.

Weeks start on Monday (`WEEK_STARTS_ON`), matching `lib/calendar/range.ts` and
`lib/journal/week-dates.ts`.

### "Today" inside a third-party calendar

`react-day-picker` decides which cell is today from `new Date()` and compares
it against the local `Date` it builds for each cell — so left alone it marks
the **runtime's** today, which on Vercel is UTC. For two hours every night the
owner is already on the next day and the calendar still highlighted the
previous one.

`components/ui/calendar.tsx` exports **`appToday()`** and passes it as
`DayPicker`'s `today`: `appTodayParam()` for the app-zone calendar date, then
re-materialised as a local `Date`, because local is the zone `DayPicker`
compares in — the same two-step as `parseDateValue`. `DatePicker` uses it for
`defaultMonth` too, so an empty field opens on the owner's month rather than
the server's. It is hydration-safe by construction: `appTodayParam()` resolves
identically on a UTC server and a Madrid browser, unlike the `new Date()` it
replaces.

The regression test in `components/ui/date-picker.test.tsx` pins the clock to
`22:30Z` — inside the two-hour window — so it holds whatever time the suite
runs at. It first showed up as a nightly CI failure in two unrelated suites
that asked for the "Today, …" cell by its app-zone name.

## DST

`Europe/Madrid` is CET (+1) in winter and CEST (+2) in summer, so the repair
for a shifted row is never "subtract two hours" — it depends on the instant.
Two edge cases are pinned by tests in `lib/time/index.test.ts`:

- **Spring forward** — the requested wall clock may not exist (Madrid has no
  02:30 on the changeover day). `TZDate` resolves it forward into the new
  offset, so the saved instant is the nearest real one.
- **Fall back** — the wall clock occurs twice. The earlier (still-DST)
  reading wins, deterministically.

Calendar arithmetic uses whole _calendar_ days, not 24-hour blocks, so an
event dragged across a changeover keeps its wall-clock time.

## Testing

`vitest.config.ts` sets `process.env.TZ = "UTC"` at config load — Node caches
its zone on first use, so setting it inside a test body doesn't reliably take
effect. UTC is deliberately _not_ the app zone: it's what Vercel and CI run
in, so every unit test exercises the exact server/app-zone mismatch that
caused the bug.

Assertions must use **absolute instants** (`…Z` or epoch) or an app-zone
rendering. An assertion like

```ts
expect(result.startsAt).toEqual(new Date("2026-08-01T19:00:00")); // ✗
```

re-parses the same wall-clock string the code under test parses, so it agrees
with the code in _every_ timezone and can never catch a shift. Write

```ts
expect(result.startsAt.toISOString()).toBe("2026-08-01T17:00:00.000Z"); // ✓
```

The e2e suite runs the Next server with `TZ=UTC` and the browser with
`timezoneId: "Europe/Madrid"`, reproducing the production split that made this
bug unobservable locally.

## Repairing rows saved under the bug

`scripts/fix-shifted-times.mts` (`pnpm fix:shifted-times`) re-reads a stored
instant's UTC wall clock as an app-zone wall clock — see
`lib/time/shift-repair.ts` for why that is exact across DST while an offset
subtraction is not. It defaults to a dry run, requires `--before=<deploy
instant>` to scope the affected rows, writes a backup on `--apply`, and
supports `--revert`.

It is **not idempotent** — a second pass shifts corrected rows again.

Corrected rows that are mirrored to Google are marked `pending_push`, so the
next sync run patches Google with the corrected time. That path records the
new etag on the link and `isOwnEcho` then skips the inbound reflection, so the
correction cannot start an echo or conflict storm (see
[google-sync.md](google-sync.md)).
