# Stream session planner

Issue #19. Plan live sessions specifically — topic, a pre-stream checklist,
and a post-stream retro — so that going live is calm and repeatable instead
of chaotic.

## Data model

Three new tables in `lib/db/schema.ts`:

| Table                             | Columns (essence)                                                                          | Notes                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `streams`                         | `id`, `title`, `notes`, `retro_notes`, `game_id` null, `event_id` null, `event_track` null | one row per planned stream                                           |
| `stream_checklist_items`          | `id`, `stream_id` FK (cascade), `label`, `done`, `position`                                | per-stream, local edits only                                         |
| `stream_checklist_template_items` | `id`, `label`, `position`                                                                  | single global default template — single-user app, no template "sets" |

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

`game_id` (#105) is a nullable FK into the `games` library with
`ON DELETE SET NULL` — which game the session is about, picked from the library
rather than typed into the topic, so streams can be grouped and counted by game.
Deleting a game untags the stream; it never deletes it. The picker sits on both
the create dialog and the detail page, saved behind the page's single Save like
every other field. See [content-games](content-games.md).

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
  or the same day, for all-day — rather than a second end-time picker; that
  shape was already single-day, which #115 then made a rule everywhere, see
  below),
  `updateStreamDetails` (title, prep notes and the retro — every editable
  field on the detail page, in one statement), `deleteStream` (hard delete,
  checklist cascades, and — since #104 — the linked event is deleted with it,
  batched, so no purple calendar block outlives its session; the Google-side
  delete is pushed exactly as `deleteEvent` pushes it), `toggleChecklistItem`/
  `addChecklistItem`/`removeChecklistItem`, `addTemplateItem`/
  `removeTemplateItem`, and `attachEventToStream`/`detachEventFromStream`
  (attaching an already-claimed event surfaces a friendly error before ever
  reaching the DB's `unique(event_id)` constraint). Every action calls
  `verifySession()` first.
- **`lib/content/stream-schema.ts`**: zod schemas for capture, detail edits
  (topic + prep notes + retro together), and checklist/template item labels.
- **`lib/content/stream-session.ts`** (`server-only`): `insertStreamSession`,
  the one place a session and its template snapshot are created. Shared by
  `createStream` and by the calendar's own `createEvent`/`updateEvent` (#104),
  so a stream planned from the calendar is seeded identically to one planned
  here. Its `leading` option puts a caller's event INSERT at the head of the
  same `db.batch`, keeping "the block and its session" one round trip.

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
  and its own "New stream" button, inline in the list header next to
  `TemplateEditor` (same pattern as `IdeaCapture`; #85 retired the floating dock
  that used to render it, see docs/inbox.md). `TemplateEditor` (a dialog
  reachable from the list header) edits the default checklist.
- **Detail** (`/content/streams/[id]`): `StreamDetailsForm` owns every text
  field on the page — topic, prep notes and the retro (always editable,
  visually promoted once the stream's event has passed) — behind a **single
  "Save changes" button**, disabled until something differs from what's
  stored. #102 collapsed what used to be two Save buttons, one per section: it
  was never clear which one committed what. Because the fields are separated on
  screen by `StreamEventSection` (the linked event, or an "Attach an event"
  action backed by `EventAttachPicker` — the inverse of `IdeaLinkPicker`) and
  `StreamChecklist` (large tap targets, inline add/remove), those two sections
  are passed to `StreamDetailsForm` as **children**, which keeps the reading
  order while letting one component hold all three values. Both keep their own
  instant-save actions — a checklist tick or an attach shouldn't wait for a
  Save.

  The fields are **controlled**, never `defaultValue`: a save revalidates this
  route, so the server hands back a fresh `stream` on the next render, and an
  uncontrolled Base UI field both warns about the changed `defaultValue` and
  keeps painting the old string. Local state is re-seeded from the props only
  when the saved columns actually change, so a revalidation triggered by a
  checklist toggle doesn't discard in-progress typing.

## Streams on the calendar (#104)

## A stream is a single day (#115)

A stream begins and ends on the same day, so nothing in the app asks for a
second date. The planner never did — `streamCaptureSchema` takes one `date`
plus a start time and derives the end from a fixed 2h slot. #115 made that the
rule rather than a habit, everywhere a stream's span can be set:

- **The event editor** shows one **Date** plus **From**/**To** for a Stream
  block, with no end-date input mounted at all.
- **Dragging** a purple block moves it; **resizing** it clamps to 23:59 of its
  own day rather than running into tomorrow.
- **MCP** has no `endDate` parameter on either calendar write tool.

The rule and its wording live in `lib/calendar/single-day.ts`; the full
rationale — including why it is not a Postgres CHECK, and the accepted limit
that a 23:00 → 01:00 stream can't be represented — is in
[`calendar.md`](calendar.md#the-content-track-is-single-day-115).

A scheduled stream's block is **Twitch purple**, its own track alongside work
and content — see docs/calendar.md for how that kind is derived (it is not a
third `events.track` value) and docs/design-system.md for the palette. Two
consequences land here:

- **Planning is symmetric.** A stream planned from the calendar's track picker
  is indistinguishable from one planned here, checklist and all.
- **Delete is symmetric too.** Deleting the linked event still just
  unschedules the stream (the `ON DELETE SET NULL` above is unchanged), but
  deleting the _stream_ now also deletes the event. That reverses the original
  "left alone" choice deliberately: once a block advertises a session, leaving
  one behind means a purple block promising something that no longer exists.
  The confirmation dialog says so before it happens.

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

Unit (Vitest + RTL): `stream-schema` (capture/detail/checklist-label
validation, incl. an over-long retro failing the whole save), `lib/data/streams` (`bucketStreams`'s upcoming/past/unscheduled
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
one Save commits topic + prep notes + retro together and they survive a
reload, with exactly one save control on the page; deleting the linked calendar
event leaves the stream unscheduled; a mobile-viewport capture flow. The
delete-leaves-unscheduled check retries the whole navigation (not just the
assertion) via `expect(...).toPass()`, since a single `page.goto` can race
Neon's read-after-write consistency immediately after a delete.
