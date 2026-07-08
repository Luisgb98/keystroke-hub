# Idea capture & organization

Issue #15. The first feature in the Content track: a fast, low-friction way
to capture video/stream ideas and organize them by a pipeline status, format,
and free-form tags.

## Data model

One table, `ideas` (`lib/db/schema.ts`), deliberately independent of
`events` — an idea only ever _becomes_ content later; it doesn't share the
calendar's `track` discriminator.

| Column                      | Type                                               | Notes                                         |
| --------------------------- | -------------------------------------------------- | --------------------------------------------- |
| `id`                        | `uuid` PK, default random                          |                                               |
| `title`                     | `text` **not null**                                | the only required field                       |
| `notes`                     | `text` null                                        | free text                                     |
| `format`                    | enum `video \| stream \| either`, default `either` |                                               |
| `status`                    | enum, default `spark`                              | pipeline stage — see below                    |
| `tags`                      | `text[]` not null default `{}`                     | free-form, GIN-indexed for containment        |
| `project_id`                | `uuid` null                                        | forward-compat for #24 (Projects) — no UI yet |
| `created_at` / `updated_at` | `timestamptz` not null                             |                                               |

`format`/`status` are Postgres enums (`pgEnum`), matching the `track`/
`connection_status` precedent in `docs/calendar.md` — adding a pipeline stage
later is a cheap `ALTER TYPE ... ADD VALUE` migration rather than a data
rewrite.

## Pipeline vocabulary

`lib/content/idea-status.ts` defines the **full** stage set up front —
`spark → outlined → scripted → recorded → published`, plus `parked` — not
just the initial stage, so issue #16's board consumes this one module as its
single source of truth rather than inventing its own. `spark` is the initial
stage every idea starts at.

**Status is the only field editable after capture** (a plain `<select>` on
`IdeaCard`, committing immediately via the narrow `updateIdeaStatus` server
function — no confirmation, since it's cheap to change back). There's no
full edit-all-fields surface in this issue; the acceptance criteria only
calls for capture, listing/filtering, and a pipeline status from day one.
Editing title/notes/format/tags is deferred until a concrete need shows up
(likely #16).

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
  `rescheduleEvent`'s precedent), `deleteIdea` (hard delete, no
  soft-archive, matching #11's event-delete precedent). Every action calls
  `verifySession()` first and `revalidatePath("/content/ideas")` on success.
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
- **`/content`**: was a bare placeholder; now links to `/content/ideas` via
  a simple card, leaving the rest of the placeholder in place for scripts
  and the streaming schedule (later issues). The hub-vs-direct-route
  question is left open for whoever builds the next Content feature.

## Resilience to a missing database

Same contract as `/calendar` (`docs/database.md`): `getIdeas`/
`getDistinctIdeaTags` are wrapped in a `try`/`catch` in `page.tsx`, falling
back to an empty list rather than throwing — CI's e2e job has no
`DATABASE_URL`, and this route is linked from primary navigation.

## Testing

Unit (Vitest + RTL): `idea-schema`, `idea-status`, `lib/data/ideas`'s filter
→ SQL mapping, `actions` (DB mocked), and the `idea-capture`/`idea-card`/
`idea-filters`/`idea-empty-state` components.

e2e (`e2e/ideas.spec.ts`, real DB via `e2e/support/ideas-db.ts` with
`[e2e-*]`-prefixed rows and per-suite cleanup, skipped where `DATABASE_URL`
is unset): title-only and full capture, status change surviving a reload,
delete-with-confirmation, search/format/status/tag filtering individually
and combined (URL reflects state and survives a reload), the "no matches"
empty state, and a mobile-viewport FAB → dialog capture flow. The
true "no ideas exist at all" empty state isn't covered by e2e (no way to
guarantee a shared dev database is genuinely empty) — it's covered by the
`IdeaEmptyState` unit test instead.
