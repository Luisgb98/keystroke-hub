# Dashboard: the "Today" home screen

Issue #28. The app's front page and default landing view after login —
today's events from both tracks, today's log status with a jump-in CTA, and
a snapshot of content in flight, all above (or near) the fold on a phone.
Depends on #14 (agenda widget), #21 (daily log), #16 (content pipeline) —
all shipped, so this issue is pure composition, not new data modeling.

## Composition

`app/(app)/page.tsx` (the `/` route) is a thin, synchronous layout shell
around three self-fetching blocks, mirroring `UpcomingAgenda`'s own shape
rather than centralizing data fetching in the page:

- **Agenda** — `UpcomingAgenda` (`components/agenda/upcoming-agenda.tsx`,
  issue #14) reused as-is, with a tighter `maxItems={5}` so it doesn't
  dominate the mobile fold.
- **Today's log** — `LogStatusCard` (`components/dashboard/log-status-card.tsx`).
  Fetches via `getDayLog(todayParam())` (`lib/data/daily-logs.ts`,
  `lib/journal/dates.ts`) and summarizes through the pure
  `buildLogSummary` (`lib/dashboard/log-summary.ts`).
- **Content in flight** — `ContentSnapshotCard`
  (`components/dashboard/content-snapshot-card.tsx`). Fetches via
  `getIdeasInFlight()` (`lib/data/ideas.ts`) and tallies through the pure
  `buildContentSnapshot` (`lib/dashboard/content-snapshot.ts`).

No new tables or migrations — every block reads existing data
(`events`, `daily_logs`/`daily_log_items`, `ideas`).

## Log status summary

`buildLogSummary` (`(DayLog) → LogSummary`) treats a day as `not_started`
until it carries any signal at all — a planned/done item, a retro, or a
mood — not just that the log row exists (rows are created lazily on first
write, see `docs/journal.md`). Rolled-over items are excluded from both the
planned and done counts, the same treatment `buildStandupView`
(`lib/journal/standup.ts`) gives them: they're yesterday's business. The
CTA label adapts — "Start today's log" vs. "Continue today's log" — and
always deep-links to `/journal`; a secondary link goes to
`/journal/standup`.

## Content-in-flight snapshot

`getIdeasInFlight()` queries every idea except `published` (shipped),
oldest-in-stage first. `buildContentSnapshot`
(`(Idea[]) → ContentSnapshot`) is a pure, self-contained filter + tally —
it re-derives the in-flight set itself rather than trusting the caller to
have pre-filtered, so it's safe to unit-test with a mixed idea list and
stays correct even if a future caller forgets to filter. It returns a
per-stage count for every in-flight pipeline stage (`idea` through
`edited`, reusing `IDEA_STATUSES`/`IDEA_STATUS_LABEL` from
`lib/content/idea-status.ts` — the same source of truth #16's board uses)
plus the single idea that has sat longest in its current stage, the same
"stuck longest" signal the board sorts by (`groupIdeasByStatus`,
`lib/content/board.ts`). The card deep-links to `/content/board`.

## UI / UX

Mobile-first, single column, DOM order agenda → log CTA → content
snapshot — the order the two-column desktop grid (agenda in its own
column; log + content stacked in the other) falls out of for free, with no
separate layout code path. A `font-mono` date header (today's day name +
date, via `formatDayLabel`/`todayParam`) sits under the `<h1>Dashboard</h1>`
heading, which is load-bearing: `e2e/auth.spec.ts` asserts on it as the
post-login landing heading, so it's kept literal rather than folded into
any block. Each card carries its track's border accent
(`border-track-work-border` / `border-track-content-border`) per
`docs/design-system.md`. Empty states are designed, not accidental:
"Nothing logged yet today", "Nothing in the pipeline. Capture an idea to
get started."

## Resilience to a missing database

Same contract as `/calendar` and `/content` (`docs/database.md`): each
block wraps its own query in a `try`/`catch` and falls back to that
block's empty state rather than throwing — CI's e2e job has no
`DATABASE_URL`, and `/` is the very first page a session hits after login.

## Testing

Unit (Vitest): `lib/dashboard/log-summary.test.ts` (not-started vs.
started, planned/done counting, rolled-over exclusion, retro/mood-only
days), `lib/dashboard/content-snapshot.test.ts` (per-stage tallies,
published exclusion, stuck-longest ordering, empty pipeline).

e2e (`e2e/dashboard.spec.ts`, real DB via `e2e/support/ideas-db.ts` and
`e2e/support/events-db.ts` with `[e2e-dashboard]`-prefixed rows, serial
mode, skipped where `DATABASE_URL` is unset): a seeded event renders in
the agenda block and deep-links to the calendar; seeded ideas produce
stage counts and a deterministic stuck-longest pick (backdated
`stageEnteredAt`) that deep-links to the board; adding a planned item via
the journal's quick-add is reflected in the log card's CTA and deep-links
into `/journal` and `/journal/standup`; a dedicated mobile-viewport check
asserts the date header and log block are above the fold with no
horizontal overflow. The log-status case writes to the real "today" (like
the journal mobile-viewport check in `e2e/mobile.spec.ts`) since the
dashboard only ever shows today — cleanup removes only the
`[e2e-dashboard]`-prefixed item it added, never the day's retro/mood or
any other item. `dashboard.spec.ts` is excluded from the `mobile-chrome`
Playwright project (`playwright.config.ts`) since it seeds/clears real
rows and already covers its own mobile viewport via `test.use`, the same
precedent as the other DB-backed suites.

The genuinely-empty-dashboard state (no events, no log, no ideas at all)
isn't covered by e2e — no way to guarantee a shared dev database is truly
empty — the same tradeoff `docs/content-ideas.md` documents for the ideas
list; it's covered by the `log-summary`/`content-snapshot` unit tests
instead.
