# Calendar

The shared calendar (issue #10) is the app's defining concept: one set of
day/week/month views rendering both the work and content tracks together,
strictly separated but visually side by side. Issue #10 owns the `events`
data model, the read path, and the three views; issue #11 (below) owns
creating, editing, and deleting events.

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

### The content track is single-day (#115)

**Work events may span days; content and stream events may not.** A stream and
a video release both begin and end on the same day — every one the owner has
ever scheduled does — so the second date picker was pure friction, and its
stale default (23:00 → the next day's 00:00) could produce a "two-day release"
nobody asked for. Meetings, trips and multi-day work items, by contrast, are
real.

`lib/calendar/single-day.ts` holds the rule: `isSingleDayKind`,
`isSingleAppDay`, `endOfStartDay`, `clampToStartDay` and the one wording
(`SINGLE_DAY_MESSAGE`) that the editor, the calendar and MCP all speak. All
four write paths route through it:

| Path                  | What it does                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `eventFormSchema`     | For content/stream, **ignores any submitted `endDate`** and derives it from `startDate`; rejects an end time at or before the start. |
| `EventEditor`         | Mounts no end-date input for those kinds — one Date plus From/To.                                                                    |
| `rescheduleEventCore` | Reads the row's kind and **refuses** a multi-day span (the drag already clamped, so anything arriving multi-day ignored the rule).   |
| `useEventReschedule`  | Clamps a resize to 23:59 of the start's day, in the gesture.                                                                         |

`endOfStartDay` is deliberately **23:59, never the next day's midnight** — that
instant reads as a different wall-clock day, which is exactly the state the
rule exists to make unrepresentable.

**Why not a Postgres CHECK.** "Same day" is an app-timezone wall-clock notion
(see [timezone.md](timezone.md) and issue #95); expressing it in SQL would
hardcode the timezone into a constraint. The rule lives at the one schema
choke point instead, with the two calendar-gesture paths above clamping before
they ever reach it.

**Known limit, accepted deliberately.** A stream that genuinely runs past
midnight (23:00 → 01:00) can't be represented. Flagged on the issue; there is
no overnight escape hatch.

Existing rows are audited and repaired by
`scripts/fix-multi-day-content.mts` (`pnpm fix:multi-day-content`) — a dry run
by default, `--apply` to clamp, `--revert` to undo. Unlike
`fix-shifted-times.mts` it _is_ idempotent.

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
tokens and pairs color with an icon (`Briefcase`/`Clapperboard`/`Radio`) and a
label (`track-styles.ts`) — color is never the only signal.

## Three kinds of block, two tracks (#104)

A block reads as one of three things — **Work**, **Content** or **Stream** —
but `events.track` is still the two-value enum above. `TrackKind`
(`lib/calendar/track-kind.ts`) is the display-level type, and `stream` is
**derived**: a content-track event is a Stream block exactly when a `streams`
row schedules it (`CalendarEvent.streamId`, left-joined in
`lib/data/events.ts`).

Widening the enum instead would have dragged the whole two-world boundary with
it — which Google calendar an event syncs through, whether an idea may link to
it (`idea_event_links`' content-only CHECK), whether a meeting note may attach
— and needed a backfill to make existing streams read as streams. Deriving it
buys all of that for free:

- Attaching an event to a stream turns its block purple and detaching turns it
  back, with no calendar-side write at all.
- An edit arriving from Google can never change an event's kind: inbound sync
  writes title/description/times/all-day and never touches `track` or
  `streams` (`lib/sync/engine.ts`, guarded by a unit test).
- A stream block syncs through the **content** connection, because that is
  genuinely its track.
- Every stream that already existed reads as purple the moment this ships.

`TrackPicker` offers all three. Picking **Stream** stores `track: 'content'`
and creates the session behind the block, checklist snapshotted from the
current template (`insertStreamSession`, `lib/content/stream-session.ts`) —
so a purple block always corresponds to a real session on the planner. The
editor links straight to it.

Changing an existing block's kind:

| From → to        | What happens                                                                  |
| ---------------- | ----------------------------------------------------------------------------- |
| Content → Stream | the session is created behind it                                              |
| Stream → Content | the session survives as **Unscheduled**, checklist and notes intact           |
| Stream → Work    | refused — "Unlink the stream first", the same friendly message #67 introduced |

Stream → Work stays a refusal rather than a silent unlink because a work-track
event can't legally carry the content-pinned link at all; unlinking on the
user's behalf would be a bigger, less reversible decision than the one they
asked for. Either way, no purple block is ever left with nothing behind it —
and the reverse direction is covered too: deleting a stream on the planner now
takes its calendar block with it (see docs/content-streams.md).

## Scroll contract

Issue #87: on the calendar page the **only** thing that scrolls is the grid.
The sidebar and the calendar header never move, and the sidebar never changes
size. Three layers cooperate, and each one is load-bearing:

1. **The app shell is viewport-locked.** `app/(app)/layout.tsx` renders
   `div.h-dvh.overflow-hidden` and makes `<main>` the app's only vertical
   scrollport (`overflow-y-auto min-h-0`). That height-caps the sidebar so it
   can never stretch with tall content. This is deliberately scoped to the app
   shell rather than `body`: `/login` (self-sufficient `min-h-dvh`) and
   `/styleguide` render **outside** this layout and still rely on body scroll —
   the styleguide's section nav is `sticky top-0` against it, and a global
   `overflow-hidden` would make that page unscrollable.
2. **The calendar page opts out of `<main>`'s scrolling.** Its wrapper is
   `min-h-0 flex-1 overflow-hidden`, so the heading and `CalendarHeader` stay
   pinned and the remaining height goes to the view.
3. **Each view owns its scrollport.** Day, week (both the phone agenda list and
   the desktop time grid) and month each mark theirs `data-slot="calendar-scroll"`.
   The weekday header, the all-day row and the month's weekday labels sit
   _outside_ it so they stay pinned.

The trap in all of this is flexbox's `min-height: auto`: a flex item's
automatic minimum size is its content, so without `min-h-0` (or a non-`visible`
`overflow`) on **every** item in the chain, the views silently stretch to their
content and the page starts scrolling again. That's why `min-h-0` appears on
the shell's `<main>`, the page wrapper, each view root and each scrollport, and
why `components/calendar/scroll-contract.test.tsx` asserts the structure
directly rather than trusting the pixels.

Two consequences worth knowing:

- **Sticky headers inside `<main>`** (e.g. `components/content/script/script-editor.tsx`)
  now stick to `<main>`'s scrollport rather than the body's — same visual
  result, different containing scroller.
- **The sidebar keeps `overflow-y-auto`.** On a window shorter than the nav
  itself the cap would otherwise clip the theme/settings footer; on any normal
  window there is nothing to overflow, so the sidebar still can't scroll.

`e2e/calendar-scroll.spec.ts` covers all of it — page-has-no-scroll, the
sidebar's bounding box before/after a wheel, the empty grid still filling the
viewport, month view on a short window, the phone agenda list with the bottom
nav staying tappable, plus non-regression checks for long shell pages and the
styleguide's body scroll. It needs no `DATABASE_URL`: the empty 24-hour grid is
a fixed 96rem tall (`HOURS_IN_DAY × HOUR_HEIGHT_REM`), so it overflows any
viewport on its own.

## Resilience to a missing database

The calendar page always renders its shell (heading, view switcher,
prev/next/today) even if the database is unreachable — `getEventsInRange` is
wrapped in a `try`/`catch` in `page.tsx`, falling back to an empty event list
rather than throwing. This matters because CI's e2e job has no
`DATABASE_URL` (see `docs/database.md`), and the calendar page is linked from
primary navigation and exercised unconditionally by `e2e/shell-navigation.spec.ts`.

## Seeding events for local dev/e2e

`scripts/seed-events.mts` inserts fixture events (both tracks, all-day and
timed, deliberate overlaps) anchored on the current date, useful for
demoing/exercising the read path without clicking through the creation UI:

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

## Creating, editing, and deleting events (#11)

Mutations go through Server Functions in `lib/calendar/actions.ts`
(`createEvent`, `updateEvent`, `deleteEvent`) — same shape as
`lib/auth/actions.ts`: each calls `verifySession()` first (Server Functions
are reachable via direct POST, not just the UI), validates with the single
Zod schema in `lib/calendar/event-schema.ts` (shared so validation rules
live in exactly one place), writes via Drizzle, and calls
`revalidatePath("/calendar")` on success. `updateEvent`/`deleteEvent` treat
"no row matched" as a returned field error, not a thrown exception — the
row may have been deleted concurrently (e.g. from Drizzle Studio).

There's no optimistic UI: a single round-trip plus a `pending` flag from
`useActionState` (surfaced as a disabled/"Saving…" submit button) is fast
enough for a personal app. Delete is a hard delete — no audit trail.

**Form surface**: `EventEditor` (`components/calendar/event-editor.tsx`) is
the shared create/edit form, in a `variant="sheet"` dialog — a bottom sheet on
a phone, the centred panel on desktop (#114, see [mobile.md](mobile.md)).
`TrackPicker` never pre-selects a track; submit stays disabled until one is
chosen, which is how "the track choice can never be ambiguous" is enforced.

**The date fields branch on the chosen track** (#115). Work gets the full
Start/End range. Content and stream get a single **Date** plus **From**/**To**
times, with no end-date input mounted at all — the value rides along in a
hidden field that `setSpan` keeps equal to `startDate`, so flipping the picker
back to Work can never submit a stale midnight-spanning end date. Switching
_to_ a single-day kind also repairs the span: quick-add is track-agnostic, so
tapping the 23:00 slot hands the dialog a 23:00 → next-day-00:00 default that
is a real work meeting and an impossible stream — the end time moves to 23:59
rather than the dialog opening on a form that is already invalid. A time the
owner typed themselves is left alone for validation to speak to.

**Making events tappable**: `EventChip` and `EventBlock` are each
self-contained client components — a `<button>` wrapping the existing
visual markup, with their own local `EventEditor` (edit mode) dialog state.
There's no lifted/global dialog controller. This mattered for `MonthView`:
each day cell used to be one big `<Link>` wrapping its chips, which would
now nest a `<button>` inside an `<a>` (invalid HTML). The cell was
restructured so the `Link` is a full-bleed absolutely-positioned sibling
(`z-0`) behind the date number, chips, and the per-cell "+" button (`z-10`)
— empty cell area still falls through to the link, chips/buttons intercept
their own clicks.

**Quick-add entry points**, each producing prefill values via the pure
helpers in `lib/calendar/quick-add.ts`:

- Tapping an hour slot in the day/week time grid (`DayColumn` renders one
  button per hour, positioned behind the `EventBlock`s) — 1h duration
  starting on the hour.
- A month cell's "+" affordance (hover-revealed on desktop, permanently
  visible below `md` since #114 — a pointer can't reveal it on a phone) — an
  all-day default for that date. It doesn't intercept the cell's own
  day-navigation tap.
- A persistent "+ New event" button in `CalendarHeader`, the universal
  fallback on every view/breakpoint — starts at the next 30-minute mark.

## Drag-to-reschedule & resize (#13)

Rescheduling by dragging or resizing is built on native Pointer Events
(`pointerdown`/`setPointerCapture`/`pointermove`/`pointerup`), not a
drag-and-drop library — a calendar needs continuous coordinate-to-time math
with snapping and duration-preserving moves, which `dnd-kit` and similar
libraries don't model (and have no resize concept at all). Pointer Events
also unify mouse, touch, and pen in one code path.

**Layering, pure math up:**

- **`lib/calendar/drag.ts`** — pure, unit-tested functions: `snapMinutes`
  (15-minute steps, matching Google Calendar's default), `moveEvent`
  (day + minute offset, duration-preserving), `moveEventByDays` (whole-day
  shift for month/all-day chips, which have no time-of-day axis),
  `resizeEvent` (one edge, floored at a 15-minute minimum duration), and
  `isNoopShift` (a drop back at the origin is not a mutation).
- **`hooks/use-pointer-drag.ts`** — a DOM/geometry-agnostic pointer gesture
  state machine (`idle → pressed → dragging → committing`). Mouse/pen engage
  past a 5px movement threshold; touch requires a ~350ms long-press first (so a
  scroll swipe isn't mistaken for a lift) and cancels the pending timer if the
  touch moves like a scroll before it fires; once engaged it blocks `touchmove`
  so the surface underneath can't pan away. `Escape`/`pointercancel` abort
  without committing. It reports raw pixel deltas plus the live pointer
  position — callers convert those to day/minute offsets using `drag.ts` (or,
  on the content board, to a target column using `lib/content/board-drag.ts`),
  which keeps the conversion independently testable and lets component tests
  inject geometry instead of depending on real layout. It lives in `hooks/`
  rather than under `components/calendar/` because the content board's card
  drag & drop (#89) runs on the same machine — one drag idiom, no library (see
  docs/content-ideas.md).
- **`components/calendar/use-event-reschedule.ts`** — shared by every view:
  wraps the new `rescheduleEvent` Server Function in React's `useOptimistic`
  so a drag/resize applies instantly in the UI. Unlike #11's mutations
  (deliberately non-optimistic — see above), a drag needs to feel
  instantaneous while it's still in flight. If the mutation fails, the
  optimistic override is simply discarded once the transition ends (the
  base `events` prop never moved), which reads as an automatic revert; an
  error toast explains why. On success, a toast offers "Undo", which is
  just calling `rescheduleEvent` again with the original bounds.
- **`rescheduleEvent`** (`lib/calendar/actions.ts`) — a narrower mutation
  than `updateEvent`: only `startsAt`/`endsAt` change, validated by
  `rescheduleSchema` (`lib/calendar/event-schema.ts`). Same
  verify-session/revalidate/schedule-push shape as the other mutations, so
  Google sync propagation (#12) falls out of reusing that path rather than
  needing new sync code.

**Per-view scope:** `EventBlock` (day/week grid) supports vertical move
(time), horizontal move across days (week's desktop grid only, via
`crossDayDrag`), and resize handles on whichever edge is the event's real
boundary in that column (`DaySegment.start`/`end` matching the full event's
bounds — a clamped edge on a multi-day event shows no handle). `EventChip`
supports whole-day move across cells in month view only; all-day-row and the
week/day mobile agenda list stay tap-only in this iteration. Geometry (px
per minute, day-column/month-cell width) is measured from the DOM at the
start of each gesture — via the live root font size for the vertical
axis and `getBoundingClientRect()` on the relevant ancestor for the
horizontal axis — rather than hardcoded, so it can't drift from the CSS
that actually renders the grid.

**Known follow-ups, deliberately deferred:** auto-scroll near the grid edge
while dragging, drag across the all-day row, and drag target-cell
highlighting in month view. None are required by #13's acceptance criteria;
the touch long-press behavior in particular is worth a manual pass on a
real device before relying on it.

## Upcoming-items agenda widget (#14)

`<UpcomingAgenda />` (`components/agenda/upcoming-agenda.tsx`) is a
self-fetching, embeddable "what's next" card spanning **today + tomorrow**
across both tracks, mounted on the home page (`app/(app)/page.tsx`) in place
of its earlier placeholder. It takes only `className`/`maxItems` — a host
page doesn't provide data, just drops it in.

- **Horizon**: fixed at today + tomorrow (`AGENDA_HORIZON_DAYS` in
  `lib/calendar/agenda.ts`), capped at `DEFAULT_AGENDA_MAX_ITEMS` (8) rows
  total across both days. This isn't a prop — it's the widget's identity, not
  a per-embed setting.
- **`getUpcomingEvents(now, horizonEnd)`** (`lib/data/events.ts`) fetches
  events starting before the horizon that haven't ended: `endsAt >= now` for
  timed events, `endsAt >= startOfDay(now)` for all-day ones (same reasoning
  as `getEventsInRange`'s inclusive `endsAt` boundary above) — in-progress
  events are intentionally included so a meeting you're currently in still
  shows up.
- **`buildAgenda(events, now, maxItems)`** (`lib/calendar/agenda.ts`) is the
  pure grouping logic, unit-tested without a database: buckets events into
  "Today"/"Tomorrow", pins all-day items before timed ones within a day,
  labels the currently-in-progress item "Now", and tightens the "hasn't
  ended" boundary to strictly exclude an event ending exactly at `now` (it
  just finished). Bucketing is **track-specific by event kind**:
  - A **timed** event lands in exactly one bucket — the first horizon day it
    overlaps (its start day, or Today if it began earlier and is still in
    progress). This keeps a **cross-midnight** event (e.g. a late stream
    ending after 00:00) from rendering twice — once under Today and again
    under Tomorrow with a misleading start-time label (issue #58).
  - A **multi-day all-day** event still appears once per day bucket it
    covers, mirroring the calendar's own segment behavior rather than
    collapsing to one row.
- **`AgendaItemRow`** (`components/agenda/agenda-item.tsx`) reuses the same
  visual language as `EventChip`/`EventBlock` (track icon + surface classes
  - label, conflict-note indicator) and opens the same `EventEditor` edit
    dialog on tap — no new mutation surface.
- **Resilience**: same contract as the calendar page — a `getUpcomingEvents`
  failure is caught and renders the empty state rather than breaking the
  host page.
- **Empty state**: when both days have nothing, a quiet "Nothing coming up"
  panel — never a bare gap.
