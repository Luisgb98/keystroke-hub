# Idea capture & organization

Issue #15 (capture, list, filters), issue #16 (the pipeline board), and
issue #20 (the publish checklist). A fast, low-friction way to capture
video/stream ideas, a board that shows every idea's pipeline stage at a
glance, and a per-video checklist so nothing ships without title, thumbnail,
description, and tags being confirmed done.

## Data model

One table, `ideas` (`lib/db/schema.ts`), deliberately independent of
`events` — an idea only ever _becomes_ content later; it doesn't share the
calendar's `track` discriminator.

| Column                      | Type                                               | Notes                                                                      |
| --------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| `id`                        | `uuid` PK, default random                          |                                                                            |
| `title`                     | `text` **not null**                                | the only required field                                                    |
| `description`               | `text` null                                        | the publish-facing video description (#88)                                 |
| `format`                    | enum `video \| stream \| either`, default `either` |                                                                            |
| `status`                    | enum, default `idea`                               | pipeline stage — see below                                                 |
| `tags`                      | `text[]` not null default `{}`                     | free-form, GIN-indexed for containment                                     |
| `project_id`                | `uuid` null                                        | forward-compat for #24 (Projects) — no UI yet                              |
| `game_id`                   | `uuid` null                                        | the game this idea is about — see [content-games](content-games.md) (#105) |
| `release_event_id`          | `uuid` null                                        | the idea's release on the calendar — see Release below (#71)               |
| `release_event_track`       | enum `track` null                                  | always `content` when set; composite FK + CHECK (#71)                      |
| `stage_entered_at`          | `timestamptz` not null, default `now()`            | when `status` last changed — powers #16's board (see below)                |
| `created_at` / `updated_at` | `timestamptz` not null                             |                                                                            |

`format`/`status` are Postgres enums (`pgEnum`), matching the `track`/
`connection_status` precedent in `docs/calendar.md` — adding a pipeline stage
later is a cheap `ALTER TYPE ... ADD VALUE` migration rather than a data
rewrite. `edited` was added this way by #16. _Removing_ a value is the
expensive direction — Postgres has no `DROP VALUE`, so #70 swapped the enum
via a text round-trip (migration `0017`), remapping retired rows in the same
step. #71 added the two `release_event_*` columns (migration `0018`); no
backfill was needed since every existing idea is simply unscheduled. #105 added
`game_id` (migration `0020`) the same way — a nullable FK into the new `games`
library, `ON DELETE SET NULL` so deleting a game untags the idea rather than
destroying it. It is deliberately **not** another tag: tags describe a video for
publishing, the game says what the work is about (see
[content-games](content-games.md)).

## Pipeline vocabulary

`lib/content/idea-status.ts` defines the **full** stage set up front —
`idea → scripted → recorded → edited → published` — not just the initial
stage, so #16's board consumes this one module as its single source of truth
rather than inventing its own. `idea` is the initial stage every idea starts
at. Every consumer (the list view's status `<select>`, the status filter
chips, the board columns) renders from `IDEA_STATUSES`, so the vocabulary
changes in one place.

#70 trimmed the pipeline to these five, dropping the never-used intake split
(`spark`/`outlined`) and the `parked` side-track so every label maps 1:1 to a
real video-production stage. The migration remapped all three retired
statuses into `idea` (the closest surviving stage — mapping `outlined`
forward to `scripted` would have falsely claimed a script exists), so no idea
was lost from the grid or board.

**Every field is editable after capture** (#71). The pencil on `IdeaCard`
opens the shared `IdeaEditor` (`components/content/idea-editor.tsx`, also the
capture surface) prefilled with the idea's title, description, format, tags,
and release date/time; `updateIdea` (`lib/content/actions.ts`) persists the whole
form. The script keeps its own dedicated editor page (see docs/scripts.md), so
the edit dialog links out to it rather than editing script inline.

Status is still a separate, immediate commit: a plain `<select>` on `IdeaCard`
and #16's board move menu both go through `updateIdeaStatus` (no confirmation,
cheap to change back). It resets `stage_entered_at` to `now()`, but **only
when the status actually changes** (re-selecting the current status, or a
stale optimistic retry, must not reset the board's time-in-stage clock).
`updateIdea` deliberately leaves `status`/`stage_entered_at` untouched.

## Release date & the calendar (#71)

An idea's release is a **content-track `events` row owned by the idea** —
`release_event_id`/`release_event_track` point at it, with the same
belt-and-braces composite-FK + content-only CHECK + `unique(release_event_id)`
pattern as `streams` (`docs/content-streams.md`). The event is the **source of
truth** for the release date/time, so this falls out for free:

- The release shows on the content calendar the moment it's set — no calendar
  code changed; it renders as any other content event (`Release: <title>`).
- Dragging or deleting that event on the calendar keeps the idea in sync:
  `ON DELETE SET NULL` unschedules the idea (nulls its pointer), and the
  `idea_event_links` cascade removes the join row.
- Google Calendar sync (#12) needs no new code — `createIdea`/`updateIdea`/
  `deleteIdea` use the same `schedulePush(pushEvent*)` after-commit contract as
  `lib/calendar/actions.ts`.

The time defaults to **19:00** (`DEFAULT_RELEASE_TIME`, the channel's standard
publish slot) when a date is set without one; the event is a nominal
`RELEASE_EVENT_DURATION_MINUTES` (60 min) block. `updateIdea` derives the
transition (none→set creates, set→changed rewrites, set→cleared deletes) by
comparing the desired release against the idea's current `release_event_id`,
re-read from the DB (not trusted from the client). Because Neon's HTTP driver
has no transactions, the writes run sequentially, idea-first, so a later
failure degrades to an unscheduled idea rather than a lost capture.

### One-tap reschedule from the card (#102)

Shifting a release is the most frequent edit a content schedule takes, so it
doesn't go through the edit dialog: the **release chip on `IdeaCard` (and the
detail page) is the reschedule control**. Clicking it opens a
`DatePicker`/`TimePicker` popover in place and `rescheduleIdeaRelease` moves the
span — a narrow, direct-args mutation in the shape of `updateIdeaStatus`, so the
title, tags and description the user never opened are never re-sent or
re-validated. Notes:

- **Only the release chip.** `IdeaScheduledEvents` takes `releaseEventId` and
  swaps just that chip; every other chip points at an event the idea merely
  links to, which this surface doesn't own, and keeps its calendar-day link. The
  release chip trades that link away — the calendar has its own navigation, the
  reschedule is what the card can't otherwise offer.
- **The event id comes from the idea's row**, never from the client, so the
  action can't be pointed at an arbitrary `events` row.
- **The title is left alone.** A move is not a rename; `releaseEventTitle` is
  `updateIdea`'s business, and it's derived from a field a reschedule can't
  change.
- Sync and revalidation ride the same `schedulePush(pushEventUpdated)` +
  `revalidatePath` contract as every other release change, so the calendar and
  Google Calendar follow without new code.

## Tags & the five-tag publishing standard (#71)

Five tags is the publishing standard (`PUBLISHING_TAG_STANDARD`,
`lib/content/idea-schema.ts`). The `IdeaEditor` form shows a live `n/5` counter
and copy that reads the idea as incomplete until it has exactly five; `IdeaCard`
shows the same `n/5` hint whenever a saved idea's tag count isn't five. Capture
and edit **may save with fewer** (quick capture stays quick), but the schema
**rejects more than five** so the form drives toward the standard rather than
sprawling.

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
  `useActionState`, same shape as `lib/calendar/actions.ts`'s `createEvent`;
  optionally saves a script and creates the release event), `updateIdea` (the
  full edit-all-fields form action — #71), `rescheduleIdeaRelease` (narrow
  release-only move behind the card's release chip — #102), `updateIdeaStatus` (narrow,
  direct-args mutation — mirrors `rescheduleEvent`'s precedent; shared by the
  list's inline `<select>` and #16's board move menu), `deleteIdea` (hard
  delete, no soft-archive, matching #11's event-delete precedent; also deletes
  the idea's release event). Every action calls `verifySession()` first;
  `createIdea`/`updateIdea`/`updateIdeaStatus`/`deleteIdea` revalidate
  `/content/ideas` and `/content/board`, plus `/calendar` whenever the release
  event changed.
- **Validation**: `lib/content/idea-schema.ts` — one zod schema
  (`ideaCaptureSchema`) shared by the capture form and `createIdea`; title
  required/trimmed/max-length, everything else optional with defaults
  (`format` → `either`).

## UI

Mobile-first, one-handed capture is the design center:

- **Capture & edit**: `IdeaEditor` (`components/content/idea-editor.tsx`) is
  the shared create/edit form (a `mode` prop, mirroring `EventEditor` — see
  docs/calendar.md), rendered in a `Dialog` for both viewports. `IdeaCapture`
  (`components/content/idea-capture.tsx`) owns the create-mode dialog and the
  "New idea" button that opens it, rendered inline in the page header beside the
  Board link (#85 retired the floating dock that used to render it, see
  docs/inbox.md); `IdeaCard`'s pencil opens the editor in edit mode. Title is
  auto-focused; format defaults to "Either" via a three-way segmented control
  (mirrors `TrackPicker`'s visual language, but — unlike track — always has a
  default selection since format is optional). Create mode has an inline
  Markdown script field; edit mode links out to the script page instead. The
  script field is a **capture** surface, not the editing surface (#93): the
  shared `Textarea` is `field-sizing-content` with no ceiling, so pasting a
  finished `.md` used to stretch the dialog to thousands of pixels. The call
  site caps it (`max-h-40`, `max-h-[45dvh]` once expanded) and lets it scroll
  inside itself, with `overscroll-contain` so a touch scroll doesn't chain out
  to the dialog's own `overflow-y-auto` body. Because the text is no longer all
  visible, a mono word counter beside the label (the same idiom as the tag
  counter) reports what landed, and an Expand/Collapse toggle appears once the
  script outgrows the collapsed field (`lib/content/script-stats.ts` decides,
  from an estimate of wrapped lines). The Description textarea is capped the
  same way. Both render their own field errors now — the script's 200,000-char
  cap and the description's 4,000-char cap used to reject server-side while the
  dialog showed only the generic form error; a rejected script also
  auto-expands so the offending text can be trimmed. The
  release date/time use the shared `DatePicker`/`TimePicker` (#86) — typed
  `yyyy-MM-dd`/`HH:mm` fields with a themed calendar/time popover, replacing the
  native `<input type="date">`/`type="time"` whose popups rendered as
  OS-default white surfaces. The release time stays disabled until a release
  date is set, and Clear empties both.
- **List**: `IdeaCard` shows title, format icon + label, tag chips (mono
  font per the keystroke identity) with an `n/5` incomplete hint, the four
  publish copy blocks (below), relative created time, the inline status
  control, and edit/script/delete actions. Cards render in a responsive grid.
  The **title is a stretched link** to the idea's detail page (#73, below): the
  whole card is the click target, while each interactive control (the header
  buttons, copy blocks, project chip, event chips, status select) opts back out
  with `relative z-10` so it stays independently clickable — the standard
  stretched-link pattern, since a card full of nested buttons can't be wrapped
  in one anchor.
- **Uniform, publish-ready cards (#72)**: every card is the **same height**
  regardless of description length — the grid uses `auto-rows-fr` and each
  `IdeaCard` is `h-full` with a `flex-1` content column and the status footer
  pinned via `mt-auto`, so a long description never stretches its card past
  its neighbours. The title is `line-clamp-2` and the description
  `line-clamp-3`; the description uses `whitespace-pre-line` so the author's
  paragraph breaks show inside the clamp rather than collapsing.
- **Copy-to-clipboard blocks (#72)**: `IdeaCopyActions`
  (`components/content/idea-copy-actions.tsx`) renders four comfortable-tap-target
  buttons — **Title**, **Title + tags**, **Description + tags**, **Tags** — each
  copying one exact text block so publishing metadata is copy-paste, never a
  retype. The block text is built by the pure `formatIdeaCopyBlocks`
  (`lib/content/idea-copy.ts`): title/description and tags are separated by a
  blank line, the author's line breaks are preserved verbatim, and tags render
  as **hashtags** (`#speedrun #glitch`, #94) — the form actually pasted when
  publishing, matching the filter chips. A hashtag can't carry spaces, so a
  multi-word tag collapses into one (`boss rush` → `#bossrush`); tag entry and
  storage are unchanged (still comma-separated, spaces allowed). A block with
  nothing to copy (no description, no tags) renders disabled. Clipboard idiom follows `CopySummaryButton`
  (see docs/journal.md): success toast + brief check-icon confirmation, error
  toast when the browser blocks clipboard access.
- **Status control (#72, #73)**: the themed shadcn `Select`
  (`components/ui/select.tsx`, Base UI) — trigger and option popup follow the
  app theme in both modes rather than rendering a browser-default white
  dropdown. #73 extracted it into `IdeaStatusSelect`
  (`components/content/idea-status-select.tsx`) so the card and the detail page
  share one implementation (a `size` prop covers the compact card vs. the
  roomier detail page). It commits inline through `updateIdeaStatus` (no
  confirmation); the closed trigger shows the human status label via
  `SelectValue`'s formatter, and the same publish nudge (`uncheckedCount`)
  applies. The shown value is **optimistic** (`useOptimistic`, the same
  treatment `PipelineBoard` gives this mutation) — #102 fixed it reading
  straight off the `status` prop, which left the trigger displaying the old
  status, greyed out while pending, until the revalidated page landed. A failed
  action needs no rollback code: the transition settling without a revalidated
  prop reverts the optimistic value itself.
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

## Detail page (issue #73)

`app/(app)/content/ideas/[id]/page.tsx` — a per-idea page reached by clicking a
card's title. Shows **everything** about one idea on a single finished page:
title, description (paragraph breaks preserved via `whitespace-pre-line`, no
clamp), tags with the `n/5` standard hint, format, status, release date/time,
linked calendar events and project, the four publish copy blocks, and the
script. Nests the existing `[id]/script` editor route underneath, which is left
untouched (still linked from search results, the board card, the edit dialog,
and event-linked ideas).

- **Data**: one `getIdeaWithScript(id)` (404s an unknown id via `notFound()`)
  plus the same `getScheduledEventsForIdeas`/`getProjectSummariesForIdeas`
  batch loaders the list uses, called with this one id. Like the script page
  (and unlike the list/board), it has **no** missing-database resilience
  contract (`docs/database.md`) — it's only reachable from a card link, and
  there's nothing to show without the idea. The `notFound()` + `loading.tsx`
  streaming-status tradeoff is the same one documented in `docs/scripts.md`.
- **Composition**: `IdeaDetail` (`components/content/detail/idea-detail.tsx`) is
  a presentational server component composing the interactive client pieces —
  `IdeaDetailHeader` (format + edit/delete, reusing `IdeaEditor` and
  `DeleteIdeaDialog`; a successful delete routes back to the list via
  `DeleteIdeaDialog`'s new `onDeleted` callback, since the current idea is
  gone), the shared `IdeaStatusSelect` and `IdeaCopyActions` and
  `IdeaScheduledEvents`, and `IdeaScriptSection` (below). Mobile-first, centered
  `sm:max-w-2xl` column like the stream/project detail pages.
- **Script — read by default, explicit edit (#73)**: `IdeaScriptSection`
  (`components/content/detail/idea-script-section.tsx`) renders the Markdown
  **read-only by default** (the polished `ScriptReadingView`) so the creator's
  default posture is reading their own content, e.g. while recording. An
  explicit **Edit** button reveals the autosaving write surface; editing chrome
  is visible only while editing, and **Done** flushes any pending save and
  returns to the rendered view. The write surface reuses the shared
  `useScriptAutosave` behavior, so it is identical to the dedicated
  `ScriptEditor` page (see docs/scripts.md).

## Board (issue #16)

`/content/board` — a Kanban-style view, one column per `IDEA_STATUSES`
stage, so the pipeline's shape (and what's stuck where) is visible at a
glance. Cross-linked with the ideas list via header links on both routes.

- **Layout**: `PipelineBoard` renders a horizontally-scrolling, snap-scrolled
  (`snap-x snap-mandatory`) row of `StageColumn`s — fixed-width (~85vw mobile,
  20rem desktop) so the phone-usable acceptance criterion needs no JS. Exactly
  five columns, one per pipeline stage. Each column is a shelf with its own
  muted surface, a rail in the content-track colour beside the stage name
  (solid `--primary` on **Published**, so the end of the line reads
  differently), and a mono count chip; cards sit inside as `bg-card` tiles with
  a content-track left edge, and the column body is its own vertical
  scrollport. Buttons everywhere on the page — card actions, checklist chip,
  the checklist dialog, the header's "Ideas list" link — come from
  `components/ui/button.tsx`, never hand-rolled surfaces (#89, see
  docs/design-system.md).
- **Sorting**: each column sorts oldest-in-stage first (by
  `stage_entered_at`) — the card that's been stuck longest surfaces first,
  the signal the board exists to expose. `groupIdeasByStatus`
  (`lib/content/board.ts`) is the pure grouping+sorting function; it lives
  outside `lib/data/ideas.ts` deliberately (that module is `server-only`,
  and `PipelineBoard` — a Client Component — needs to re-run the grouping
  client-side after every optimistic move).
- **Moving cards — two paths, one commit**: dragging a card into another
  column (#89, below) or the `MoveMenu` dropdown on each `BoardCard`, which
  lists every _other_ stage (next stage emphasized in the content-track
  colour). Both call the same `handleMove`, so optimism, rollback and the
  publish nudge are shared rather than reimplemented per path. The menu is not
  a legacy leftover: it is the only path that works from the keyboard or with
  a screen reader, and the only one that can reach a stage that isn't on
  screen — a drag can only target a visible column.
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

### Drag & drop (issue #89)

Cards are dragged between columns with the pointer, on the app's **one drag
idiom**: `hooks/use-pointer-drag.ts`, the state machine extracted from the
calendar's drag-to-reschedule (#13, see docs/calendar.md) rather than a new
dependency. Mouse/pen engage past a 5px threshold; touch needs a ~350ms
long-press, and a swipe that moves before that timer fires is treated as a
scroll — which is what lets a finger both pan the board and lift a card. No
drag-and-drop library is involved: `@dnd-kit` has had no release since
December 2024 (failing the latest-stable-deps rule), and a sortable library
would be overkill for a board with no within-column ordering.

- **Layering**: `lib/content/board-drag.ts` is pure and unit-tested —
  `resolveDropColumn` (pointer position → the column box under it, or `null`)
  and `resolveDropMove` (adds "…and it isn't where the card came from", the
  board's counterpart to the calendar's `isNoopShift`). DOM reading lives in
  `useBoardDrag` (`measureColumns`), the gesture in `usePointerDrag`. Same
  split as the calendar: geometry out of the hook, math independently testable.
- **Column-level targeting**: the drop indicator highlights the whole target
  column (`data-drop-target`), never a slot between cards — columns auto-sort
  oldest-in-stage first, so there is nothing to aim at within one. The whole
  column box counts, header and empty-state placeholder included, which is why
  an empty column is a valid target. A drop outside every column is a no-op,
  not a snap to the nearest one.
- **One gesture at a time**: the hook lives in `PipelineBoard` (via
  `useBoardDrag`), not in each card — only one card can be airborne, and the
  hit-test needs the board element anyway. Cards hand their idea to
  `startDrag` on pointerdown, and skip it when the press landed on one of
  their own controls (script link, checklist chip, move menu).
- **No layout during a drag**: the lifted card stays in place as a dimmed
  placeholder and a `BoardDragPreview` ghost follows the pointer, portalled
  into `document.body`. Translating the real card would be clipped twice over
  (the column is a vertical scrollport, the board a horizontal one) and would
  put layout work on every pointer move.
- **Scroll vs. drag on touch**: once a drag engages, `usePointerDrag` blocks
  `touchmove` (non-passive) so the board can't pan under the finger.
  `touch-action: none` can't do that job — it is latched at touchstart, so it
  would have to kill swipe-to-scroll from a card as well.
- **Cancel & failure**: `Escape` or `pointercancel` abandons the drag with the
  card untouched; a rejected `updateIdeaStatus` follows the same
  optimistic-rollback + error-toast path a menu move does. Dropping on
  **Published** is likewise identical to picking Published from the menu,
  publish-checklist nudge included.

## Publish checklist (issue #20)

A per-video checklist so nothing ships without title, thumbnail,
description, and tags being confirmed — visible on the board, editable per
video, and a non-blocking nudge if it's incomplete at publish time.

- **Data**: one table, `idea_checklist_items` (`lib/db/schema.ts`) —
  `id`, `idea_id` (FK → `ideas`, `ON DELETE CASCADE`), `label`, `done`
  (default `false`), `position`, `created_at`/`updated_at`. Indexed on
  `idea_id`. Unlike the stream checklist (#19), there's **no template
  table** — the four defaults (`Title`, `Thumbnail`, `Description`, `Tags`)
  are a code constant, `DEFAULT_PUBLISH_CHECKLIST_ITEMS`
  (`lib/content/publish-checklist.ts`), since a single-user app has no need
  for template management at this scope.
- **Seeding**: `updateIdeaStatus` (`lib/content/actions.ts`) seeds the four
  defaults the first time an idea's status update lands on a "late" stage
  (`recorded`/`edited`/`published`, per `isLateStage`/`LATE_IDEA_STATUSES`)
  — "no rows yet" is the gate, not a `checklist_seeded_at` marker, so a user
  who deletes every item and later re-enters a late stage gets them back
  (accepted tradeoff — see issue #20's plan comment). This runs **after**
  the status update is confirmed to have hit a real row (not batched with
  it): seeding is a nice-to-have on top of the status change, and
  `seedPublishChecklistIfMissing` swallows its own errors (logged, not
  thrown) rather than fail the whole request if the idea vanishes between
  the update and the seed (e.g. deleted from another session in the same
  instant) — a narrow race, but one that surfaced in e2e runs since the
  board's optimistic move resolves before the server request necessarily
  has, and a test's `afterEach` cleanup can delete the idea while seeding is
  still in flight. Moving directly from an early stage to `published`
  (skipping recorded/edited) still seeds and immediately nudges.
- **Editing**: `lib/content/checklist-actions.ts` — `toggleIdeaChecklistItem`
  / `addIdeaChecklistItem` (120-200 char label cap via `checklistLabelSchema`,
  `lib/content/checklist-schema.ts`) / `removeIdeaChecklistItem`, plus a
  client-facing `getIdeaChecklistItems` wrapper around the `server-only`
  `lib/data/idea-checklists.ts` query (same shape as `stream-actions.ts`'s
  `searchAttachableEvents`). No in-place rename — remove + re-add covers it.
- **Board surface**: `ChecklistChip` (`components/content/board/checklist-chip.tsx`)
  renders a `done/total` chip on `BoardCard` for ideas with checklist rows
  (nothing for early-stage ideas with none yet), styled with the
  content-track accent once complete. Tapping it opens
  `PublishChecklistDialog` — a `Dialog` wrapping the same tap-to-toggle/
  inline-add/remove idiom as `StreamChecklist`, fetching items on open via
  a Server Action. `PipelineBoard` owns which idea's dialog is open (not
  the chip itself) so the publish nudge toast's "Open checklist" action can
  open the same dialog a chip tap would. `getChecklistProgressForIdeas`
  (`lib/data/idea-checklists.ts`) is one grouped query for every idea's
  `{done, total}` — no per-card N+1, same pattern as the stream checklist's
  `getChecklistProgressForStreams`.
- **Publish nudge**: `updateIdeaStatus` returns `uncheckedCount` whenever the
  new status is `published`. The board (`PipelineBoard`) shows a `sonner`
  toast with an "Open checklist" action; the ideas list (`IdeaCard`, which
  has no chip/dialog — the checklist is board-only, per issue #20's open
  question 3) shows a plain nudge with no action. Either way **the move
  always succeeds** — the toast is purely a nudge, never a blocker, per the
  acceptance criteria. Zero checklist items is treated as vacuously
  complete: `uncheckedCount` is `0`, so no nudge fires.

## Resilience to a missing database

Same contract as `/calendar` (`docs/database.md`): `getIdeas`/
`getDistinctIdeaTags`/`getIdeasForBoard` are wrapped in a `try`/`catch` in
their respective `page.tsx`, falling back to an empty list/board rather than
throwing — CI's e2e job has no `DATABASE_URL`, and both routes are linked
from primary navigation.

## Testing

Unit (Vitest + RTL): `idea-schema`, `idea-status`, `idea-copy` (the four
publish blocks — shapes, blank-line joins, line-break preservation, and
empty-tag/empty-description degradation), `publish-checklist` (defaults,
`isLateStage` boundaries), `lib/content/board`'s grouping/sorting,
`lib/data/ideas`'s filter → SQL mapping, `lib/data/idea-checklists`'s progress
aggregation, `actions` (DB mocked, including the stage-clock guard, checklist
seeding on first late-stage entry, no-reseed on a second one, the
seeding-error-doesn't-fail-the-request path, and `uncheckedCount` on publish),
`checklist-actions`, the
`idea-capture`/`idea-card`/`idea-copy-actions`/`idea-filters`/`idea-empty-state`
components (the `idea-copy-actions` suite mocks `navigator.clipboard` and
asserts the exact copied text per block, the disabled states, and the error
toast; `idea-card` asserts the title's detail-page link and drives the themed
status `Select` as a combobox), the extracted `idea-status-select`, the detail
page's `idea-detail`/`idea-detail-header`/`idea-script-section` (read-only by
default, Edit reveals the write surface, autosave, Done returns to the rendered
view, delete routes back to the list), and the board's
`pipeline-board`/`stage-column`/`board-card`/`move-menu`/`checklist-chip`/
`publish-checklist-dialog` components.

#89 adds, for drag & drop: `lib/content/board-drag`'s pure drop resolution
(containment, edges, misses, no-op drops, zero-area columns), `measureColumns`'
DOM read, and — driven through `PipelineBoard` with stubbed column geometry,
since jsdom lays nothing out — a full drag committing the move, the drop
indicator and floating preview, empty-column drops, no-op drops (own column,
off-board), `Escape`/`pointercancel` cancellation, the publish nudge on a drop
onto Published, error-toast-and-revert on a failed drop, the touch long-press
lift, and a pre-engage swipe scrolling instead of lifting. `BoardCard` and
`StageColumn` cover the grip affordance, the controls that must not start a
drag, and the drop-target/airborne states. The shared gesture itself is tested
in `hooks/use-pointer-drag.test.tsx` (thresholds, long-press, cancels,
click-after-drag suppression, touch-scroll blocking, unmount cleanup).

e2e (`e2e/ideas.spec.ts`, `e2e/board.spec.ts`, and
`e2e/publish-checklist.spec.ts`, real DB via `e2e/support/ideas-db.ts` with
`[e2e-*]`-prefixed rows and per-suite cleanup, skipped where `DATABASE_URL`
is unset):

- **Ideas list**: title-only and full capture, status change surviving a
  reload (through the themed `Select`), delete-with-confirmation,
  search/format/status/tag filtering individually and combined (URL reflects
  state and survives a reload), the "no matches" empty state, and a
  mobile-viewport FAB → dialog capture flow. #72 adds: each of the four copy
  buttons writes the exact expected block to the clipboard (with
  `clipboard-read`/`clipboard-write` granted), two ideas whose descriptions
  differ wildly in length render at identical card dimensions, and a
  mobile-viewport check that the copy buttons are comfortable tap targets.
- **Board**: seeded ideas render in their matching column, moving a card via
  the move menu updates its column and survives a reload, parking/un-parking
  round-trips correctly, and a mobile-viewport check that columns scroll
  horizontally and the move flow works one-handed. #89 adds: a mouse drag
  between columns persisting across a reload, a drag onto an empty column, a
  drag onto Published raising the nudge, `Escape` mid-drag leaving the card
  put, drag and menu both working on the same card, and — on the mobile
  viewport — a long-press lift + drop (synthesized touch pointer events, the
  `drag-reschedule.spec.ts` recipe) plus a pre-engage swipe that scrolls the
  columns instead of lifting a card. `board.spec.ts` is
  excluded from the `mobile-chrome` Playwright project (`playwright.config.ts`)
  since it seeds/clears real rows and already covers its own mobile
  viewport via `test.use` — the same precedent as the calendar suites.
- **Publish checklist**: moving an idea into `recorded` seeds the four
  defaults; toggling/adding/removing items updates the board chip count;
  publishing with unchecked items shows the non-blocking nudge toast and
  still moves the card (skipping stages included); completing every item
  avoids the nudge; a mobile-viewport chip-tap → toggle flow.
  `publish-checklist.spec.ts` is likewise excluded from `mobile-chrome`.

- **Detail page** (`e2e/idea-detail.spec.ts`): clicking a card's title opens
  the detail page with every field shown, the four copy blocks are present, the
  script reads by default (no write surface) → Edit → autosave → Done returns to
  the rendered view and survives a reload in read mode, an unknown id shows the
  not-found UI, and a mobile-viewport check that a long script reads with no
  horizontal overflow. Excluded from `mobile-chrome` (same shared-DB rationale
  as the suites above).

The true "no ideas exist at all" empty state isn't covered by e2e (no way to
guarantee a shared dev database is genuinely empty) — it's covered by the
`IdeaEmptyState` unit test instead.
