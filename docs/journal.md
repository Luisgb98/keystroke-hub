# Daily log with end-of-day retro & standup prep

Issue #21. A per-day log of what's planned, what got done, and how the day
went, so tomorrow's standup prep is one glance instead of memory
archaeology.

Issue #22 (weekly summary view) builds directly on this and is documented in
its own section below.

## Data model

Two new tables in `lib/db/schema.ts`:

| Table             | Columns (essence)                                                                                                                  | Notes                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `daily_logs`      | `id`, `log_date` (`date`, unique), `retro`, `mood` (smallint, CHECK 1–5)                                                           | one row per calendar day, created lazily on first write |
| `daily_log_items` | `id`, `log_id` FK (cascade), `title`, `status` (`planned`\|`done`\|`rolled_over`), `rolled_over_to_id`, `position`, `completed_at` | planned/done entries for a day                          |

**No eager row per day.** A day with no writes has no `daily_logs` row at
all — `getDayLog` returns `{ log: null, items: [] }` for it, and every
mutation goes through `getOrCreateLog` (`lib/data/daily-logs.ts`), which
lazily inserts on first write (`onConflictDoNothing` + a re-fetch handles the
race where two writes hit the same not-yet-logged day at once).

`log_date` is stored and handled everywhere as a plain `yyyy-MM-dd` string
(`date(..., { mode: "string" })`), matching the app's other date-param
handling (`lib/calendar/range.ts`'s `?date=` convention) — no `Date` object
round-tripping, no timezone surprises in the data layer.

## Rollover semantics

Rolling an item over is a **history-preserving copy**, not a move:

1. A copy of the item is inserted onto the target day (the next calendar
   day, lazily creating that day's log) with `status: "planned"`.
2. The source item is marked `status: "rolled_over"` and its
   `rolled_over_to_id` is set to the copy's id.

The source stays visible on its original day — struck through, labeled
"→ rolled" — rather than disappearing, so a day's log is an honest record of
what actually happened on it, and multi-day chains (an item rolled three
days running) stay traceable via `rolled_over_to_id`. The insert + source
update happen in one `db.batch()` call (`performRollover` in
`lib/journal/actions.ts`), the same atomicity-without-transactions pattern
`createStream` uses in `lib/content/stream-actions.ts` — the neon-http driver
has no interactive `db.transaction()`.

`rolloverAllUnfinished` ("roll over all unfinished") repeats this once per
still-`planned` item, sequentially — not batched together — so each
iteration's `position` computation sees the previous iteration's insert.
Single-user, low-volume data, so the extra round trips are not a concern.

## Standup selection ("yesterday")

The naive "yesterday" is the literal previous calendar day, which is
frequently empty (a Monday standup's literal yesterday is Sunday). Instead,
`getStandupView` (`lib/data/daily-logs.ts`) finds the **most recent day
before today that has ever been logged** (`getMostRecentLoggedDate`),
skipping empty gap days (weekends, days off), and composes the view via the
pure `buildStandupView` (`lib/journal/standup.ts`, unit-tested without a
database — mirrors `bucketStreams`'s precedent in `lib/data/streams.ts`).

"Yesterday" shows only that day's `done` items (what to report); "today"
shows the current plan (`planned` + ad-hoc `done`, excluding anything already
rolled off today's log). If today has no plan yet, the standup view nudges
to add one rather than rendering an empty card.

## Queries and mutations

- **`lib/data/daily-logs.ts`** (`server-only`): `getDayLog(date)` (read-only
  day fetch), `getOrCreateLog(date)` (lazy creation), `getMostRecentLoggedDate`,
  `nextItemPosition`, and `getStandupView(today)`.
- **`lib/journal/actions.ts`**: `addItem`, `editItemTitle`, `toggleItem`,
  `deleteItem`, `rolloverItem`/`rolloverAllUnfinished`, `saveRetro`,
  `saveMood`. Every action calls `verifySession()` first and revalidates
  both `/journal` and `/journal/standup`.
- **`lib/journal/log-schema.ts`**: zod schemas for the date param, item
  title, retro text, and mood range.
- **`lib/journal/dates.ts`**: `yyyy-MM-dd` parse/format/validate, `today`
  resolution, and prev/next-day shifting — mirrors `lib/calendar/range.ts`.
  "Today" is resolved server-local (`new Date()`), the same as the
  calendar's own resolution (UTC on Vercel) — deliberately not
  timezone-aware, since past days are always editable anyway.

## UI

Mobile-first, single column, ordered for an under-a-minute fill-in flow:

- **`/journal`** (`?date=yyyy-MM-dd`, default today): `DayHeader` (date,
  prev/next, "Today" shortcut, jump-to-date), a `QuickAdd` + `ItemList`
  (optimistic check-off via `useOptimistic` — same pattern as
  `PipelineBoard` — plus per-item rollover, "roll over all unfinished", and
  removal), a second `QuickAdd` for ad-hoc done items, `MoodPicker` (5-step
  energy marker, icon + label per step, never color-only), and `RetroCard`
  (debounced autosave, ~800ms). Every client subcomponent is keyed by
  `logDate` (with a distinct prefix per component, so keys stay unique among
  siblings) so its local state — draft text, optimistic items — resets on
  day navigation instead of carrying over from the previously-viewed day.
- **`/journal/standup`**: two stacked cards, "yesterday's" done items and
  today's plan, each linking back into `/journal?date=...` for that day.
- Same DB-unreachable resilience contract as the calendar page: both routes
  render their shell (heading, empty state) rather than crashing if the
  database is unreachable, since `shell-navigation.spec.ts` visits `/journal`
  in CI without a database (see `docs/database.md`).

## Test strategy

- **Unit (Vitest)**: `lib/journal/dates.test.ts`, `lib/journal/standup.test.ts`
  (pure composition logic), `lib/journal/actions.test.ts` (mocked DB, same
  precedent as `lib/content/stream-actions.test.ts`), and component tests for
  `QuickAdd`, `ItemList`, `MoodPicker`, `RetroCard` (fake timers for the
  autosave debounce), `DayHeader`, and `StandupView`.
- **e2e (Playwright)**: `e2e/journal.spec.ts` covers the core ritual (add
  planned items, check one off, add an ad-hoc done item, retro + mood
  autosave, single-item and roll-all-unfinished rollover) against a
  dedicated far-future date window (isolated from other suites and from real
  use), plus a separate real-date suite for "past day is browsable and
  editable" and the standup view — which necessarily write to the real
  today/yesterday, so cleanup there only ever deletes items by a unique
  title prefix (`e2e/support/daily-logs-db.ts`'s `clearTestDailyLogItemsByTitle`),
  never the log row itself, so a developer's real retro/mood for those days
  is never at risk. A mobile-viewport case lives in `mobile.spec.ts`,
  excluded from the `mobile-chrome` Playwright project (like the other
  DB-writing suites) to avoid racing the `chromium` project against the same
  dev database.

# Weekly summary view

Issue #22. A read-first `/journal/week` route that aggregates one
Monday–Sunday week of daily logs into a Friday-ready narrative — done items
grouped by day, retros, and still-unfinished carried-over items — plus one
small piece of writable state (highlights) for pulling out the week's key
items before a review meeting.

## Data model

One new table in `lib/db/schema.ts`; everything else in the weekly view is a
read-side aggregation over `daily_logs`/`daily_log_items` (see above) —
nothing about those tables changes.

| Table            | Columns (essence)                                 | Notes                                                      |
| ---------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| `weekly_reviews` | `id`, `week_start` (`date`, unique), `highlights` | one row per week, created lazily on first highlights write |

`week_start` is always a Monday — the daily log's own Monday-start convention
(`WEEK_STARTS_ON = 1`, mirrored from `lib/calendar/range.ts` the same way
`lib/journal/dates.ts` mirrors it). This is enforced by normalizing in
`weekStartSchema` (`lib/journal/log-schema.ts`) before every write, not by a
database constraint — a single-user app has exactly one write path
(`saveHighlights`) to guard.

## Rollover chain collapsing ("carried over")

Rollover is a history-preserving copy chain (`rolled_over_to_id`, see above).
Naively listing every `rolled_over` item in a week would show a multi-day
rollover (Mon → Tue → Wed) three times. `buildWeekSummary`
(`lib/journal/week-summary.ts`) collapses each chain to a single entry:

1. A chain's **root** is the earliest copy visible within the fetched week —
   no in-week item points to it. (It may itself be a copy of something
   rolled over before the fetched window; in that case it's still treated as
   first-appearing on the day it's seen, since nothing earlier is visible.)
2. Walk forward via `rolled_over_to_id` as far as the target is still within
   the fetched week.
3. If the chain's final state is `done`, it contributes nothing to "carried
   over" — the done copy already appears under its own day. Anything else —
   still `planned`, `rolled_over` with a target outside the fetched week
   (the chain exits the week, e.g. rolled Friday → Saturday → next Monday),
   or `rolled_over` with a deleted (null) target — counts as carried over,
   attributed to the root's day.

This is pure-function logic, unit-tested without a database (multi-day
chains, chains entering/exiting the week boundary, deleted-target
null-safety).

## Queries and mutations

- **`lib/data/weekly-reviews.ts`** (`server-only`): `getWeekLogs(weekStart)`
  (one range query for the week's logs, one for their items), `getWeeklyReview(weekStart)`
  (read, may be `null`), `getOrCreateWeeklyReview(weekStart)` (lazy write
  path, same `onConflictDoNothing` + re-fetch race handling as
  `getOrCreateLog`), and `getWeekSummary(weekStart)` (composes via the pure
  `buildWeekSummary`).
- **`lib/journal/actions.ts`**: `saveHighlights(weekStart, highlights)` —
  `verifySession()` → validate via `highlightsSchema` → lazy
  get-or-create → update; `revalidateJournalPaths()` additionally revalidates
  `/journal/week`, since any item/retro/rollover mutation can change the
  week's summary.
- **`lib/journal/log-schema.ts`**: `weekStartSchema` (valid date,
  Monday-normalized), `highlightsSchema` (same length cap as `retroSchema`).
- **`lib/journal/week-dates.ts`**: `yyyy-MM-dd` week-start parse/format/shift
  (`weekStartParam`, `parseWeekParam`, `shiftWeekParam`,
  `isCurrentWeekParam`, `weekDayParams`, `formatWeekLabel`) — mirrors
  `lib/journal/dates.ts`'s day equivalents.
- **`lib/journal/week-summary.ts`**: pure `buildWeekSummary(weekStart, days, review)`
  (grouping, retro collection, rollover chain collapsing) and pure
  `formatWeekSummaryMarkdown(summary)` (the "Copy as Markdown" formatter).
- **`lib/journal/mood.ts`**: `moodLabel(value)` — text-only mirror of
  `MoodPicker`'s 5-step scale, kept separate so non-UI code (the Markdown
  formatter) doesn't pull a `"use client"` component into its import graph.

## UI

Mobile-first, single column, ordered for reading aloud top-to-bottom:

- **`/journal/week`** (`?week=yyyy-MM-dd`, default the current week; any date
  inside a week normalizes to its Monday, invalid/missing falls back to the
  current week): `WeekHeader` (week label, prev/next, "This week" shortcut —
  mirrors `DayHeader`), a "Copy as Markdown" button
  (`CopySummaryButton`, `navigator.clipboard.writeText` + a `sonner` toast),
  `HighlightsCard` (debounced autosave, ~800ms — mirrors `RetroCard`, keyed
  by `weekStart` so drafts reset on week navigation), then `WeekSummaryView`:
  done items grouped by day (Mon–Fri always shown, even with a muted
  "Nothing logged." line; Sat/Sun shown only when they have data — a fully
  empty week gets a friendly empty state linking to today's log), retros
  (with their mood label alongside, since the data is already fetched), and
  carried-over items (each linking back to the day it first appeared).
  Each day group links back to `/journal?date=...`.
- The main `/journal` page gets a "Week" button next to "Standup", linking to
  `/journal/week`.
- Same DB-unreachable resilience contract as the other journal routes: the
  shell (heading, empty state) renders rather than crashing if the database
  is unreachable.

## Test strategy

- **Unit (Vitest)**: `lib/journal/week-dates.test.ts` (Monday normalization,
  shift, label formatting across month/year boundaries, invalid-param
  fallback), `lib/journal/week-summary.test.ts` (grouping, empty
  days/weeks, retro+mood collection, the full rollover-chain-collapse matrix,
  and `formatWeekSummaryMarkdown`), `lib/journal/actions.test.ts`'s
  `saveHighlights` cases, and component tests for `WeekHeader`,
  `HighlightsCard` (fake timers for the autosave debounce),
  `CopySummaryButton` (mocked `navigator.clipboard`), and `WeekSummaryView`.
- **e2e (Playwright)**: `e2e/weekly-summary.spec.ts` covers day grouping and
  retros, previous/next week navigation and deep-linking, highlights autosave
  surviving a reload, a rolled-over item appearing exactly once under
  "Carried over", the copy-to-clipboard flow, and the invalid-week-param
  fallback — against a dedicated far-future date window distinct from
  `journal.spec.ts`'s own, plus a small real-date suite confirming the
  current week is reachable from `/journal`. Cleanup uses
  `e2e/support/daily-logs-db.ts`'s existing helpers plus a new
  `clearTestWeeklyReviews`. A mobile-viewport case lives in `mobile.spec.ts`,
  excluded from the `mobile-chrome` Playwright project like the other
  DB-writing suites.

# Weekly self-assessment (non-punitive)

Issue #23. A light weekly self-check-in — a self-rating plus three short
reflection prompts — so the developer can spot trends over time without a
KPI system judging them. Self-measurement helps only if it stays gentle: the
goal is awareness, not grades.

## Non-punitive framing rules

These rules constrain every UI and copy decision in this feature, and should
constrain any future extension of it:

- **No thresholds, no red/green judgment, no streak counters.** The rating's
  selected state uses a single neutral accent color, never a color ramp.
- **No percentages styled as achievement.** Signals are phrased as plain
  observation sentences ("You logged 3 of 5 weekdays."), never a progress bar
  or a score.
- **Unassessed weeks are gaps, not failures.** The trend view renders them
  as quiet, muted rows — no missing-streak framing.
- **Signals are derived, never stored.** Storing a computed "grade" would
  freeze it; deriving at read time keeps the framing free to evolve later.

## Data model

No new table — extends the existing `weekly_reviews` row (issue #22) rather
than adding a second week-keyed table, since the machinery for lazy
create/upsert-by-week already exists there:

| Column        | Type                            | Notes                                                           |
| ------------- | ------------------------------- | --------------------------------------------------------------- |
| `rating`      | `smallint`, nullable, CHECK 1–5 | Same nullable-smallint-with-CHECK pattern as `daily_logs.mood`. |
| `went_well`   | `text`, nullable                | Reflection prompt.                                              |
| `drained_me`  | `text`, nullable                | Reflection prompt.                                              |
| `change_next` | `text`, nullable                | Reflection prompt.                                              |

All nullable: any subset of the assessment can be filled in independently,
and the row is still lazily created on first write via the existing
`getOrCreateWeeklyReview` (no change to that function).

## Signal derivation

`lib/journal/signals.ts` computes `WeekSignals` as a pure function over the
same `WeekDayInput[]` + partial `WeekSummary` (`doneByDay`, `carriedOver`)
that `buildWeekSummary` already has in scope — no new queries. It's called
from inside `buildWeekSummary` itself and attached as `WeekSummary.signals`,
so the week page and the assessment card share one fetch.

- `weekdaysLogged` — count of the week's first 5 days (Mon–Fri) with a log
  row or any items.
- `doneCount` — total items with status `done` across the week (sum of
  `doneByDay[*].done.length`).
- `carriedOverCount` — reuses `WeekSummary.carriedOver.length` (the
  rollover-chain-collapsed "still open" count from issue #22) rather than
  recomputing chain logic.
- `trackedCount` — `doneCount + carriedOverCount`, the denominator for the
  "X of Y items got done" sentence.

`weekSignalSentences(signals)` renders these as 1–3 muted-foreground prose
lines, with a single friendly line for a week with nothing logged at all
(avoiding a wall of zeros).

Note on precision: `daily_log_items` has no field distinguishing "planned
then completed" from "added directly as done" (`addItem`'s ad-hoc-done
path), so `doneCount` cannot separate the two. The signal is worded around
this ("items logged this week got done") rather than claiming a stricter
"planned vs. done" ratio it can't actually measure.

## Queries and mutations

- **`lib/journal/log-schema.ts`**: `weeklyRatingSchema` (int 1–5, nullable —
  mirrors `moodSchema`), `assessmentNoteFieldSchema` (the three prompt keys),
  `assessmentNoteSchema` (trimmed text, capped at 2000 characters).
- **`lib/journal/actions.ts`**: `saveWeeklyRating(weekStart, rating | null)`
  and `saveAssessmentNote(weekStart, field, value)` — both `verifySession()`
  → validate → `getOrCreateWeeklyReview` → update → `revalidateJournalPaths()`
  (now also revalidating `/journal/week/trend`).
- **`lib/data/weekly-reviews.ts`**: `getRecentWeeklyReviews(throughWeekStart, limit)`
  — the most recent reviewed weeks at or before a given week, for the trend
  view. Returns only weeks that have a row; the trend route fills gaps.
- **`lib/journal/trend.ts`**: `recentWeekStarts(throughWeekStart)` (the fixed
  12-week-start range, oldest first) and the pure `buildAssessmentTrend`
  (matches reviews to that range, unassessed weeks becoming explicit
  `{ rating: null, changeNext: null }` gaps).

## UI

- **`week-rating-picker.tsx`**: 5 tappable segments with word anchors —
  "Rough … Bumpy … Steady … Strong … Great" — deliberately different
  vocabulary from the daily mood picker's energy scale (`MoodPicker`'s
  "Drained … Energized"), since this is the week's overall texture, not an
  average of moods. Structured like `MoodPicker`: tap to save, tap the
  selected step again to clear, keyboard accessible via native `<button>`s.
- **`weekly-assessment-card.tsx`**: the rating picker plus three
  autosave textareas (mirrors `RetroCard`'s ~800ms debounce and "Saved"
  indicator), all optional. Mounted on `/journal/week` after
  `WeekSummaryView`, keyed by `weekStart` so drafts reset on week navigation.
- **`weekly-signals.tsx`**: server-rendered, muted-foreground prose from
  `weekSignalSentences`.
- **`/journal/week/trend`**: `assessment-trend.tsx` renders one row per week
  (oldest first), each a link back to `/journal/week?week=...`: the week
  label (JetBrains Mono, matching `WeekHeader`'s convention), a 5-dot rating
  strip (filled dots = rating, single neutral accent, no color ramp), and
  the week's "change next week" note (the actionable thread between weeks).
  An unassessed week shows all-muted dots and a quiet "Not assessed" line
  instead of being omitted. Reachable via a "Trend" button next to the week
  page's "Journal" back-link.
- **Markdown export**: `formatWeekSummaryMarkdown` (the "Copy as Markdown"
  button) deliberately does **not** include the assessment. That export is
  standup/reporting material for other people; the assessment is
  self-reflection, and mixing the two invites self-censorship in what's
  written.
- Same DB-unreachable resilience contract as the other journal routes: both
  the week page's assessment section and the trend route render their shell
  (or an empty-state trend) rather than crashing if the database is
  unreachable.

## Test strategy

- **Unit (Vitest)**: `lib/journal/signals.test.ts` (empty week, partial
  week, no-tracked-items week, all-carried-over week — no division by zero),
  `lib/journal/trend.test.ts` (`recentWeekStarts` boundaries,
  `buildAssessmentTrend` gap-filling), `lib/journal/log-schema.test.ts`
  additions for rating bounds and prompt length caps,
  `lib/journal/actions.test.ts`'s `saveWeeklyRating`/`saveAssessmentNote`
  cases (create-vs-update, clearing, invalid input), and component tests for
  `WeekRatingPicker` (mirrors `MoodPicker.test.tsx`), `WeeklyAssessmentCard`
  (fake timers, mirrors `RetroCard.test.tsx`), `WeeklySignals`, and
  `AssessmentTrend` (gap rendering, row links).
- **e2e (Playwright)**: `e2e/weekly-assessment.spec.ts`, gated on
  `DATABASE_URL` like `weekly-summary.spec.ts`, against its own far-future
  date window: fill rating + prompts and reload to confirm persistence, edit
  an existing assessment in place (no duplicate row), confirm a different
  week's assessment state doesn't bleed across navigation, and the trend
  page listing an assessed week alongside unassessed gap neighbors. Cleanup
  reuses `clearTestWeeklyReviews`. A mobile-viewport case lives in
  `mobile.spec.ts`, excluded from the `mobile-chrome` project like the other
  DB-writing suites.
