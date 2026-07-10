# Daily log with end-of-day retro & standup prep

Issue #21. A per-day log of what's planned, what got done, and how the day
went, so tomorrow's standup prep is one glance instead of memory
archaeology.

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
