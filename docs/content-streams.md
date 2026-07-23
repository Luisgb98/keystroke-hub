# Stream session planner

Issue #19. Plan live sessions specifically — topic, a pre-stream checklist,
and a post-stream retro — so that going live is calm and repeatable instead
of chaotic.

## Data model

Three new tables in `lib/db/schema.ts`:

| Table                             | Columns (essence)                                                          | Notes                                                                |
| --------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `streams`                         | `id`, `title`, `notes`, `retro_notes`, `event_id` null, `event_track` null | one row per planned stream                                           |
| `stream_checklist_items`          | `id`, `stream_id` FK (cascade), `label`, `done`, `position`                | per-stream, local edits only                                         |
| `stream_checklist_template_items` | `id`, `label`, `position`                                                  | single global default template — single-user app, no template "sets" |

A stream's **"when" is its linked content-track calendar event** — the
`streams` row itself stores no date. `event_id`/`event_track` are nullable
(an unscheduled stream has neither), with the same belt-and-braces pattern
`idea_event_links` (#18) uses: a composite FK `(event_id, event_track)` against
`events (id, track)`, plus a CHECK that also allows NULL —
`event_track is null or event_track = 'content'` — so a stream can never end
up pointing at a work-track event, even via a track flip. `unique(event_id)`
is what makes "one stream per event" true at the DB level.

`onDelete: "set null"` on that composite FK means **deleting the linked
calendar event unschedules the stream** (nulls both columns) rather than
destroying its checklist/notes — the stream falls back to the "Unscheduled"
group. Because the calendar's own `deleteEvent` action
(`lib/calendar/actions.ts`) has no other way to learn that a stream just lost
its date, it looks up any stream referencing the event before deleting it and
revalidates `/content/streams` (and that stream's detail page) alongside its
usual `/calendar` revalidation — the DB-level `SET NULL` alone doesn't tell
Next.js which cached routes to refresh.

"Upcoming" vs "past" vs "unscheduled" is derived at query time from the
linked event's `startsAt`, not stored — **"past" is after the event's start
time**, not end-of-day, since streams are time-bound events.

## Checklist semantics

Creating a stream **snapshots** the current `stream_checklist_template_items`
into that stream's own `stream_checklist_items` (copy-on-create). Later
template edits **never** retroactively rewrite an existing stream's
checklist — the template only shapes what future streams start with. Per-
stream items can be freely added/removed/toggled afterward, independent of
the template.

## Queries and mutations

- **`lib/data/streams.ts`** (`server-only`): `getStreamsOverview()` — one
  left-join query (streams to events) plus one batched checklist-progress
  query (no N+1), then a pure `bucketStreams()` split into
  upcoming/unscheduled/past (unit-tested without a DB, mirroring
  `buildIdeaFilterCondition`'s precedent in `lib/data/ideas.ts`).
  `getStreamWithChecklist(id)` and `getTemplateItems()` back the detail page
  and template editor. `searchAttachableEvents(query)` finds content-track
  events not already claimed by another stream — the inverse of
  `searchLinkableIdeas` in `lib/data/idea-event-links.ts`.
- **`lib/content/stream-actions.ts`**: `createStream` (title required;
  planning a date creates a content-track event with a fixed 2h duration —
  or the same day, for all-day — rather than a second end-time picker),
  `updateStreamDetails` (title/notes, the only fields editable after
  capture), `deleteStream` (hard delete, checklist cascades, the linked
  event is left alone), `saveRetroNotes`, `toggleChecklistItem`/
  `addChecklistItem`/`removeChecklistItem`, `addTemplateItem`/
  `removeTemplateItem`, and `attachEventToStream`/`detachEventFromStream`
  (attaching an already-claimed event surfaces a friendly error before ever
  reaching the DB's `unique(event_id)` constraint). Every action calls
  `verifySession()` first.
- **`lib/content/stream-schema.ts`**: zod schemas for capture, detail edits,
  retro notes, and checklist/template item labels.

### Atomicity without transactions

The neon-http driver (`@neondatabase/serverless` over HTTP) has **no
interactive `db.transaction()` support** — calling it throws. `createStream`
needs the new event, the stream row, and its snapshotted checklist items to
land together, so it generates their ids up front (`randomUUID()`, not
`defaultRandom()`) and inserts them via `db.batch([...])`, which Neon executes
as a single request. That's the closest this driver gets to atomicity, and is
this project's answer to the same constraint everywhere else it hasn't come
up yet.

## UI

Mobile-first, content-track visual language (`track-content` tokens, the
`Radio` lucide icon — the same one `idea-format-styles.ts` already uses for
the "stream" idea format):

- **List** (`/content/streams`): "Upcoming" first (soonest on top), then
  "Unscheduled", then "Past" (most recent first). `StreamCard` shows title, a
  date chip (or "Unscheduled"), a checklist progress badge (`3/5`), and a
  notes indicator once a retro exists. `StreamCreate` owns the capture dialog
  but registers a "New stream" action with the shared capture dock rather than
  rendering its own floating button (same pattern as `IdeaCapture`, see
  docs/inbox.md). `TemplateEditor` (a dialog reachable from the list header)
  edits the default checklist.
- **Detail** (`/content/streams/[id]`): `StreamDetailsForm` (title/notes),
  `StreamEventSection` (shows the linked event or an "Attach an event"
  action backed by `EventAttachPicker` — the inverse of `IdeaLinkPicker`),
  `StreamChecklist` (large tap targets, inline add/remove), and
  `StreamRetroNotes` (always editable, visually promoted once the stream's
  event has passed).

## Scope cuts

- **Attaching an existing event happens on the detail page, not the create
  dialog.** Quick capture only offers "plan a new date"; attaching a
  pre-existing content event is a follow-up action, mirroring how idea<->event
  linking (#18) happens after the fact, not during idea capture.
- **No `canceled` status.** The acceptance criteria only call for
  upcoming/past; delete covers the "this isn't happening" case.
- **No `streams.ideaId` link.** An idea is raw material, a stream plan is an
  execution artifact; both can point at the same calendar event, which is how
  "this stream realizes that idea" is expressed today.
- **No manual checklist/template reordering UI.** Items append in creation
  order; `position` exists in the schema for future reordering but nothing
  writes anything other than a monotonically increasing value today.

## Testing

Unit (Vitest + RTL): `stream-schema` (capture/detail/retro/checklist-label
validation), `lib/data/streams` (`bucketStreams`'s upcoming/past/unscheduled
split incl. the same-day "past is after start time, not end of day" boundary,
`aggregateChecklistProgress`, and the DB-mocked queries), `stream-actions`
(auth gate on every action, template snapshot on create, the batch-vs-direct-
insert branching, content-track-only + already-claimed enforcement on attach,
idempotent checklist toggles), and component tests for every component under
`components/content/streams/`.

e2e (`e2e/streams.spec.ts`, real DB via `e2e/support/streams-db.ts` with
`[e2e-stream]`-prefixed rows, skipped where `DATABASE_URL` is unset): editing
the default checklist seeds those items onto a newly created stream; planning
a date creates a content-track event visible under Upcoming and on the
calendar; toggling/adding per-stream checklist items persists across reload;
writing retro notes persists across reload; deleting the linked calendar
event leaves the stream unscheduled; a mobile-viewport capture flow. The
delete-leaves-unscheduled check retries the whole navigation (not just the
assertion) via `expect(...).toPass()`, since a single `page.goto` can race
Neon's read-after-write consistency immediately after a delete.
