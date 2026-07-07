# Calendar

The shared calendar (issue #10) is the app's defining concept: one set of
day/week/month views rendering both the work and content tracks together,
strictly separated but visually side by side. This issue owns the `events`
data model, the read path, and the three views. Event creation/editing is a
separate issue (#11) — for now, events are added via the seed script below or
directly in Drizzle Studio (`pnpm db:studio`).

## Data model

`events` (`lib/db/schema.ts`) is deliberately minimal — later issues (#11
CRUD, #12 Google sync, #18 content linking, #19 streams) extend it. Track
separation is enforced three times over: a Postgres enum (`'work' |
'content'`, can't store anything else), a TS discriminated union inferred
from the Drizzle schema, and UI components that accept only a `Track` and
map it to the design system's track tokens (`docs/design-system.md`).

All-day events store `startsAt`/`endsAt` as date boundaries rather than exact
instants — a single-day all-day event has `startsAt === endsAt` at that day's
midnight. `lib/data/events.ts`'s range query uses an inclusive `gte` on
`endsAt` specifically so this boundary case still matches its own day's
`[from, to)` range.

## Range and layout math (`lib/calendar/`)

The genuinely tricky parts of a hand-built calendar are pure logic, so they
live in their own modules and are unit-tested directly:

- **`range.ts`** — computes the visible `[from, to)` range for a view/date
  (day: 1 day; week: Monday-start, 7 days; month: a 42-cell grid, which may
  spill into adjacent months), plus URL param parsing/formatting and
  prev/next/today navigation math.
- **`segments.ts`** — clamps a (possibly multi-day) event to the portion
  visible on a given day, and converts a time to minutes-since-midnight for
  positioning.
- **`layout.ts`** — the column-packing algorithm for overlapping timed
  events: groups events into overlap clusters, then assigns each a
  `column`/`columnCount` so the UI can render them side by side.

## Views

- **Day** — vertical time grid with a pinned all-day row; the primary phone
  view.
- **Week** — a stacked agenda-style list on phones (a 7-column grid is
  unreadable that narrow); the classic 7-column time grid from `md:` up. Both
  layouts exist in the DOM simultaneously and toggle via CSS breakpoints, not
  conditional rendering — keep this in mind when querying the DOM in tests.
- **Month** — a 42-cell grid; each cell links to that day's day view. Cells
  show up to `MONTH_CELL_MAX_CHIPS` events before collapsing into a "+n"
  overflow.

Every event-rendering component (`components/calendar/`) uses only the track
tokens and pairs color with an icon (`Briefcase`/`Clapperboard`) and a label
(`track-styles.ts`) — color is never the only signal.

## Resilience to a missing database

The calendar page always renders its shell (heading, view switcher,
prev/next/today) even if the database is unreachable — `getEventsInRange` is
wrapped in a `try`/`catch` in `page.tsx`, falling back to an empty event list
rather than throwing. This matters because CI's e2e job has no
`DATABASE_URL` (see `docs/database.md`), and the calendar page is linked from
primary navigation and exercised unconditionally by `e2e/shell-navigation.spec.ts`.

## Seeding events for local dev/e2e

`scripts/seed-events.mts` inserts fixture events (both tracks, all-day and
timed, deliberate overlaps) anchored on the current date, so the calendar is
demoable before #11 ships a real creation UI:

```bash
pnpm seed:events
```

It connects directly (not through `lib/db/index.ts`, which is guarded by the
`server-only` package and throws outside Next's server runtime) using
`DATABASE_URL` from `.env`/`.env.local`.

`e2e/calendar.spec.ts` seeds and cleans up its own `[e2e]`-prefixed rows per
run (see `e2e/support/events-db.ts`) — it doesn't depend on this script.
Those DB-backed e2e tests skip (like the health check) when `DATABASE_URL`
isn't set, e.g. in CI.
