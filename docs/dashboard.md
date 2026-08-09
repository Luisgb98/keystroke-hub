# Dashboard: today, then the month

Issues #28 and #110. The app's front page and default landing view after
login. It answers two questions, in that order:

- **Today** (#28) — today's events from both tracks, today's log status with
  a jump-in CTA, and a snapshot of content in flight, all above (or near)
  the fold on a phone. Depends on #14 (agenda widget), #21 (daily log), #16
  (content pipeline).
- **The month** (#110) — how the month actually went: videos published,
  streams held, ideas captured, which game ate the month, which hashtags
  keep coming back, and where the pipeline is stuck.

Neither half introduces a table or a migration; both are composition over
data the app already stores.

## Composition

`app/(app)/page.tsx` (the `/` route) is a thin layout shell around
self-fetching blocks, mirroring `UpcomingAgenda`'s own shape rather than
centralizing data fetching in the page.

The Today blocks:

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

The month-review blocks, all taking a `month` (`yyyy-MM`) prop and reading
through `lib/data/dashboard.ts`:

- **Headline numbers** — `MonthStats` (`components/dashboard/month-stats.tsx`),
  three `StatTile`s with their delta against the previous month.
- **Games** — `GameRankingCard` (`game-ranking-card.tsx`).
- **Hashtags** — `TagRankingCard` (`tag-ranking-card.tsx`).
- **Pipeline** — `PipelineCard` (`pipeline-card.tsx`).

The Today blocks render inline — they are the reason the page exists and
must not arrive late — while every month-review block streams inside its
own `<Suspense>` with a `MonthCardSkeleton` fallback, so five extra
aggregation queries can't delay the fold. The boundaries are keyed by
month, so stepping the picker swaps in skeletons for the review section
while Today stays put. (This is the first `<Suspense>` in the app;
route-level `loading.tsx` is the closest prior art.)

No new tables or migrations — every block reads existing data
(`events`, `daily_logs`/`daily_log_items`, `ideas`, `streams`, `games`).

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

## The month review (#110)

### Choosing the month

The month lives in the URL as `?month=YYYY-MM`, never in component state:
the server component reads it back on every request, so the choice survives
a reload by construction and a month is linkable. `parseMonthParam`
(`lib/dashboard/month-review.ts`) folds _missing_, _malformed_ and _future_
all onto the current month, and `MonthPicker`
(`components/dashboard/month-picker.tsx`) disables "Next" on the current
month — there is no future to review. The stepper mirrors `WeekHeader`
(`components/journal/week-header.tsx`).

Every boundary is computed in the app timezone through `lib/time`
(`appStartOfMonth`, `appAddMonths`, `formatInAppZone`), per rule 2 of
[timezone.md](timezone.md) — the #95 fix. `monthRange` returns a **half-open**
`[start, end)` instant pair, which needs no "last millisecond of the month"
fudge and stays exact across the DST changeovers that move a month boundary
by an hour. Because `yyyy-MM` sorts lexicographically the same way it sorts
chronologically, the "is this the future?" check is a string comparison, not
a second date parse.

### What each number means

| Number              | Definition                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| Videos published    | Ideas that entered `published` — `status = 'published'` **and** `stage_entered_at` inside the month |
| Streams             | Streams whose linked event's `starts_at` is inside the month **and** in the past                    |
| Ideas captured      | `ideas.created_at` inside the month                                                                 |
| Pipeline stages     | Count per `idea_status` **right now**, not month-scoped — the shape of the queue                    |
| Late-stage movement | Ideas at `recorded`/`edited`/`published` whose `stage_entered_at` is inside the month               |
| Games / hashtags    | Ideas _touched_ in the month (created **or** moved) plus streams held in the month                  |

Three judgement calls worth naming, because they bound what the numbers can
honestly claim:

1. **"Published this month" rides `stage_entered_at`**, which records the
   _latest_ stage change — so a re-touched published idea can shift months.
   `ideas.release_event_id` is the alternative, but a release event is a
   _plan_ (nullable, and it can sit in the future), not a fact, so the stage
   timestamp is the honest signal available today. A full stage-transition
   history is its own issue.
2. **A stream with no linked event can't be placed in a month at all**, so it
   is never counted here — it shows only in the unscheduled bucket on
   `/content/streams`.
3. **"Touched this month" is created-or-moved.** Using creation alone would
   make a month of pure pipeline movement look empty; using movement alone
   would erase a month of pure capture.

`GameAttention` merges the per-game idea tally and stream tally in JS rather
than SQL, so a game with streams but no ideas still comes back with a zero
on the empty side — the same reason `getGamesWithUsage` uses correlated
subqueries. Untagged rows land in a single **"No game"** bucket that is
ranked alongside real games rather than dropped; it carries no link, because
there is no "ideas without a game" view to open. Tags are a free-form
`text[]` with no normalized table, so `getTagUsage` unnests the column
_inside a subquery_ — Postgres evaluates a set-returning function after
grouping and would reject a `group by` over one in the same select list.

### Reading it

Magnitude is length, never colour: every ranked bar is a solid `bg-primary`
fill on a `bg-muted` track (`RankingBars`), square at the baseline and
rounded at the data end, with the label and count beside it as real text.
One hue at varying length keeps the rankings inside the design system (no
primary tints, see [design-system.md](design-system.md)), AA-legible in both
themes for free, and readable with no colour at all — the bar is
`aria-hidden` decoration. Bar width is each row's share of the _leader_, not
of the total, so a month with one game paints a full bar rather than a
sliver, and an all-zero month gets `share: 0` rather than `NaN` widths.

Deltas are an arrow icon plus a signed integer in muted ink — never a
green/red verdict. Fewer videos in a month you streamed more is not a
failure, and this app's voice is observation rather than judgement (see
`WeeklySignals`); it also keeps direction off colour alone. They're absolute
rather than percentages: these are small counts where "+200%" is noise and
"+2" is the fact, and a percentage against a zero month has no honest value.

Every block is a door: stat tiles → `/content/ideas?status=published`,
`/content/streams`, `/content/ideas`; a game row → `/content/ideas?game=<id>`
(the filter takes the library **id**, not the name); a hashtag row →
`/content/ideas?tag=<tag>`; a pipeline stage with anything in it →
`/content/ideas?status=<status>`; card footers → the game library, the ideas
list and the board. The pipeline card's footer says "Board →" rather than
"Open board →" — the Today block already owns that label on the same screen.

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

The month review sits below Today in the same single column, and reads
top-down: picker → headline tiles → the three ranking cards (a
`md:grid-cols-3` row on desktop, stacked on a phone). The tiles come first
on purpose — on a phone they are the part of the review worth reaching, and
the rankings elaborate on them. Long game names truncate and the bars
reflow, so the widest content `/` has ever carried still can't overflow
sideways. The three cards share a stretch grid, so their footers carry
`mt-auto` to sit on the card's bottom edge rather than floating under the
content. An empty or thin month is designed too: honest zeros with "Same
as <month>", "Nothing tagged with a game this month. Tag an idea or a
stream and the ranking fills in.", "No hashtags on this month's ideas
yet.", "Nothing reached recording or beyond this month."

## Resilience to a missing database

Same contract as `/calendar` and `/content` (`docs/database.md`): each
block wraps its own query in a `try`/`catch` and falls back to that
block's empty state rather than throwing — CI's e2e job has no
`DATABASE_URL`, and `/` is the very first page a session hits after login.

The month-review blocks distinguish _failed_ from _empty_: their view
components take `null` for "the query failed" and an empty array (or a
zero-filled snapshot) for "this month really had nothing", so a database
outage says "Couldn't load the game breakdown." instead of quietly
reporting a zero month. `MonthStats` uses `Promise.allSettled` rather than
`Promise.all` — the comparison month failing is no reason to withhold this
month's numbers, so the tiles just lose their delta lines.

## Testing

Unit (Vitest): `lib/dashboard/log-summary.test.ts` (not-started vs.
started, planned/done counting, rolled-over exclusion, retro/mood-only
days), `lib/dashboard/content-snapshot.test.ts` (per-stage tallies,
published exclusion, stuck-longest ordering, empty pipeline).

For the month review: `lib/dashboard/month-review.test.ts` covers the param
vocabulary (malformed, future and repeated `?month=` values), the month
boundaries as **absolute instants** across both offsets and the DST
changeover month, the ranking/share derivation (including the all-zero
list), deltas against an empty previous month, and the game merge with its
"No game" bucket. `lib/data/dashboard.test.ts` renders each condition to
SQL with `PgDialect` (the trick from `lib/data/ideas.test.ts`) to pin the
half-open boundary, the created-or-moved predicate, the past-only stream
rule and the unnest subquery, and drives the queries against a mocked
`getDb` for bigint coercion, stage zero-filling and empty months. Each
widget's data / empty / error states are covered by its own colocated
component test, plus `ranking-bars`, `stat-tile` and `month-picker`.

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

The month-review e2e cases seed into **April 2019** under a separate
`[e2e-month-review]` prefix. A month from before the app existed is the only
way to assert exact totals against a shared dev database full of real work —
and the prefix is deliberately not a `[e2e-dashboard]` sub-string, since that
suite clears by `LIKE` and would otherwise sweep these rows. They cover:
landing on the current month with "Next" disabled, stepping back and
surviving a reload, a future/malformed param falling back, the seeded
month's counts and deltas, the game and hashtag rankings (including the "No
game" bucket), a month before the app existed rendering honest zeros, and
deep-linking a game row and a hashtag row into the correctly filtered ideas
view. A mobile-viewport case checks the tiles precede the rankings and the
page still has no horizontal overflow. Fixtures go through
`seedTestStream` (`e2e/support/streams-db.ts`), which inserts the content
event _and_ the stream that owns it — a stream with no event can't be
placed in a month — and `seedTestIdea`'s `createdAt`/`gameId` overrides.

The genuinely-empty-dashboard state (no events, no log, no ideas at all)
isn't covered by e2e — no way to guarantee a shared dev database is truly
empty — the same tradeoff `docs/content-ideas.md` documents for the ideas
list; it's covered by the `log-summary`/`content-snapshot` unit tests
instead.
