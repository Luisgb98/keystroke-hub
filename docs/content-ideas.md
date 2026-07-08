# Idea capture & organization

Issue #15 (capture, list, filters) and issue #16 (the pipeline board). A
fast, low-friction way to capture video/stream ideas, and a board that shows
every idea's pipeline stage at a glance.

## Data model

One table, `ideas` (`lib/db/schema.ts`), deliberately independent of
`events` — an idea only ever _becomes_ content later; it doesn't share the
calendar's `track` discriminator.

| Column                      | Type                                               | Notes                                                       |
| --------------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| `id`                        | `uuid` PK, default random                          |                                                             |
| `title`                     | `text` **not null**                                | the only required field                                     |
| `notes`                     | `text` null                                        | free text                                                   |
| `format`                    | enum `video \| stream \| either`, default `either` |                                                             |
| `status`                    | enum, default `spark`                              | pipeline stage — see below                                  |
| `tags`                      | `text[]` not null default `{}`                     | free-form, GIN-indexed for containment                      |
| `project_id`                | `uuid` null                                        | forward-compat for #24 (Projects) — no UI yet               |
| `stage_entered_at`          | `timestamptz` not null, default `now()`            | when `status` last changed — powers #16's board (see below) |
| `created_at` / `updated_at` | `timestamptz` not null                             |                                                             |

`format`/`status` are Postgres enums (`pgEnum`), matching the `track`/
`connection_status` precedent in `docs/calendar.md` — adding a pipeline stage
later is a cheap `ALTER TYPE ... ADD VALUE` migration rather than a data
rewrite. `edited` was added this way by #16.

## Pipeline vocabulary

`lib/content/idea-status.ts` defines the **full** stage set up front —
`spark → outlined → scripted → recorded → edited → published`, plus
`parked` — not just the initial stage, so #16's board consumes this one
module as its single source of truth rather than inventing its own. `spark`
is the initial stage every idea starts at. `edited` was added between
`recorded` and `published` by #16 to cover the board's pipeline; every
existing consumer (the list view's status `<select>`, the status filter
chips) picked it up automatically since they all render from
`IDEA_STATUSES`.

**Status is the only field editable after capture** — a plain `<select>` on
`IdeaCard` and #16's board move menu both commit through the same
`updateIdeaStatus` server function (no confirmation needed, since it's cheap
to change back). There's no full edit-all-fields surface; editing
title/notes/format/tags is deferred until a concrete need shows up.

`updateIdeaStatus` also resets `stage_entered_at` to `now()`, but **only
when the status actually changes** (re-selecting the current status, or a
stale optimistic retry, must not reset the board's time-in-stage clock).

## Tags

Free-form `text[]`, not a normalized tag table — filter options are derived
from tags currently in use (`getDistinctIdeaTags`, an `unnest` query) rather
than a separate lookup table. Acceptable for a single-user app: renaming a
tag is a one-row `UPDATE` away if it's ever needed. Input is a single
comma-separated text field, normalized by `normalizeTags`
(`lib/content/idea-schema.ts`): trimmed, lowercased, deduped, and capped
(50 chars/tag, 20 tags) so a pathological paste can't break capture.

## Capture, filtering, and mutations

- **Route**: `app/(app)/content/ideas/page.tsx` (Server Component). List
  fetched server-side; filters/search live in URL `searchParams`
  (`?q=&format=&status=&tag=`) so filtered views are shareable and survive a
  reload — same approach as `/calendar` (`docs/calendar.md`).
- **Queries**: `lib/data/ideas.ts`. `buildIdeaFilterCondition` is split out
  as a pure function so the filter → SQL mapping is unit-testable without a
  database connection (via `drizzle-orm/pg-core`'s `PgDialect.sqlToQuery`).
  Search is `ILIKE` on title; tag filtering is array containment (`@>`).
- **Mutations**: `lib/content/actions.ts` — `createIdea` (form action via
  `useActionState`, same shape as `lib/calendar/actions.ts`'s
  `createEvent`), `updateIdeaStatus` (narrow, direct-args mutation — mirrors
  `rescheduleEvent`'s precedent; shared by the list's inline `<select>` and
  #16's board move menu), `deleteIdea` (hard delete, no soft-archive,
  matching #11's event-delete precedent). Every action calls
  `verifySession()` first; `updateIdeaStatus`/`deleteIdea` revalidate both
  `/content/ideas` and `/content/board`, `createIdea` only the list (new
  ideas always start at `spark`, which the board also renders).
- **Validation**: `lib/content/idea-schema.ts` — one zod schema
  (`ideaCaptureSchema`) shared by the capture form and `createIdea`; title
  required/trimmed/max-length, everything else optional with defaults
  (`format` → `either`).

## UI

Mobile-first, one-handed capture is the design center:

- **Capture**: `IdeaCapture` (`components/content/idea-capture.tsx`) is a
  self-contained floating "New idea" button (bottom-right thumb zone, above
  the bottom nav) + `Dialog` form — no lifted dialog controller, same
  self-contained pattern as `EventChip`/`EventBlock` in `docs/calendar.md`.
  Title is auto-focused; format defaults to "Either" via a three-way
  segmented control (mirrors `TrackPicker`'s visual language, but — unlike
  track — always has a default selection since format is optional).
- **List**: `IdeaCard` shows title, format icon + label, tag chips (mono
  font per the keystroke identity), relative created time, and the inline
  status `<select>`. Cards render in a responsive grid.
- **Filters**: `IdeaFilters` — debounced search plus horizontally-scrollable
  chip rows for format/status/tag. Holds a local optimistic copy of every
  filter (not just search text) so rapid successive chip clicks compose
  correctly instead of racing the server round-trip that updates the
  `searchParams`-derived prop.
- **Track identity**: content-track tokens (`track-content*`) +
  `Clapperboard`/`Lightbulb` iconography throughout, per the dual-track rule
  in `docs/design-system.md` — color is never the only signal.
- **Empty states**: `IdeaEmptyState` — a first-capture invitation when there
  are no ideas at all, a distinct "no matching ideas" state (with a
  reset-filters affordance) when a search/filter combination has zero
  results.
- **`/content`**: was a bare placeholder; now links to `/content/ideas` and
  `/content/board` via simple cards, leaving the rest of the placeholder in
  place for scripts and the streaming schedule (later issues).

## Board (issue #16)

`/content/board` — a Kanban-style view, one column per `IDEA_STATUSES`
stage, so the pipeline's shape (and what's stuck where) is visible at a
glance. Cross-linked with the ideas list via header links on both routes.

- **Layout**: `PipelineBoard` renders a horizontally-scrolling, snap-scrolled
  (`scroll-snap-type: x mandatory`) row of `StageColumn`s — fixed-width
  (~85vw mobile, 20rem desktop) so the phone-usable acceptance criterion
  needs no JS. `parked` renders last and visually muted (desaturated
  heading/count) so dead ideas don't read as pipeline load.
- **Sorting**: each column sorts oldest-in-stage first (by
  `stage_entered_at`) — the card that's been stuck longest surfaces first,
  the signal the board exists to expose. `groupIdeasByStatus`
  (`lib/content/board.ts`) is the pure grouping+sorting function; it lives
  outside `lib/data/ideas.ts` deliberately (that module is `server-only`,
  and `PipelineBoard` — a Client Component — needs to re-run the grouping
  client-side after every optimistic move).
- **Moving cards**: a `MoveMenu` dropdown on each `BoardCard` lists every
  _other_ stage (next stage visually emphasized), not just drag-and-drop's
  adjacent-column model — the acceptance criterion is "items can be moved
  between stages," not drag-and-drop, which is the worst interaction on a
  mobile-first board (fights scroll, needs long-press, inaccessible by
  default). One tap + one tap, identical across touch/mouse/keyboard/screen
  reader, zero new dependencies.
- **Optimistic updates**: `PipelineBoard` uses `useOptimistic` so a move
  jumps the card to the target column instantly, before the server round
  trip resolves; a failed `updateIdeaStatus` surfaces a `sonner` toast, and
  the transition settling without a revalidated `ideas` prop reverts the
  optimistic state on its own (React's built-in rollback).
- **Time-in-stage chip**: relative time via `date-fns`'s
  `formatDistanceToNow` (mono font, the keystroke accent), absolute
  timestamp in the `title` attribute.
- **No manual ordering, no status-history table**: both deliberately out of
  scope for v1 — see the plan comment on issue #16 for the reasoning.

## Resilience to a missing database

Same contract as `/calendar` (`docs/database.md`): `getIdeas`/
`getDistinctIdeaTags`/`getIdeasForBoard` are wrapped in a `try`/`catch` in
their respective `page.tsx`, falling back to an empty list/board rather than
throwing — CI's e2e job has no `DATABASE_URL`, and both routes are linked
from primary navigation.

## Testing

Unit (Vitest + RTL): `idea-schema`, `idea-status`, `lib/content/board`'s
grouping/sorting, `lib/data/ideas`'s filter → SQL mapping, `actions` (DB
mocked, including the stage-clock guard), the `idea-capture`/`idea-card`/
`idea-filters`/`idea-empty-state` components, and the board's
`pipeline-board`/`stage-column`/`board-card`/`move-menu` components.

e2e (`e2e/ideas.spec.ts` and `e2e/board.spec.ts`, real DB via
`e2e/support/ideas-db.ts` with `[e2e-*]`-prefixed rows and per-suite cleanup,
skipped where `DATABASE_URL` is unset):

- **Ideas list**: title-only and full capture, status change surviving a
  reload, delete-with-confirmation, search/format/status/tag filtering
  individually and combined (URL reflects state and survives a reload), the
  "no matches" empty state, and a mobile-viewport FAB → dialog capture flow.
- **Board**: seeded ideas render in their matching column, moving a card via
  the move menu updates its column and survives a reload, parking/un-parking
  round-trips correctly, and a mobile-viewport check that columns scroll
  horizontally and the move flow works one-handed. `board.spec.ts` is
  excluded from the `mobile-chrome` Playwright project (`playwright.config.ts`)
  since it seeds/clears real rows and already covers its own mobile
  viewport via `test.use` — the same precedent as the calendar suites.

The true "no ideas exist at all" empty state isn't covered by e2e (no way to
guarantee a shared dev database is genuinely empty) — it's covered by the
`IdeaEmptyState` unit test instead.
