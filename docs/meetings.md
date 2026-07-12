# Meeting notes

Issue #26. Captures what a meeting covered and how it went, so decisions and
context are recoverable later. Lives under `/projects/meetings`, a sibling
of the projects tracker (#24) and the improvements backlog (#25) in the
**Projects & Meetings** part of the app.

Closes the loop `docs/improvements.md` left open: "a future meeting link
(#26) will carry the 'which meeting' context properly." Meeting notes own
the improvements link, not the other way around.

## Data model

Two new tables in `lib/db/schema.ts`:

| Table                       | Columns (essence)                                                                                     | Notes                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------ |
| `meeting_notes`             | `id`, `date`, `title`, `meeting_type`, `notes`, `reflection`, `project_id`, `event_id`, `event_track` | one row per meeting      |
| `meeting_note_improvements` | `meeting_note_id`, `improvement_id`                                                                   | join table, composite PK |

**`date`** is a calendar day (`date` column, `mode: "string"`), not a
timestamp — same convention as `daily_logs.log_date`/`weekly_reviews.week_start`.
Avoids timezone drift for an all-day concept.

**`meeting_type`** is a fixed enum (`standup`, `planning`, `retro`,
`one_on_one`, `review`, `other`), documented in `lib/meetings/meeting-type.ts`
— mirrors `improvement-status.ts`'s label-map-plus-guard shape. `other` is
the escape hatch and the default.

**`project_id`** is a plain nullable FK (`onDelete: "set null"`), same shape
as `improvements.project_id` — a meeting note belongs to at most one
project, settable directly in the capture/edit form (not a separate attach
flow).

**`event_id`/`event_track`** link a meeting note to at most one **work-track**
calendar event. This reuses the belt-and-braces composite-FK + CHECK pattern
`streams` established for its (content-track) event link: a composite FK
`(event_id, event_track) -> events(id, track)` plus a CHECK constraining
`event_track` to `'work'` (or null) makes a content-track link impossible at
the DB level, not just in the picker. `unique(event_id)` keeps "at most one
meeting note per event" true at the DB level too.

**`meeting_note_improvements`** is many-to-many (composite PK, cascade both
ways): a retro can revisit an improvement across meetings, and an
improvement may come up more than once. Purely referential — linking an
improvement to a meeting note has **no status side-effect** on the
improvement itself; the improvements pipeline (`proposed -> discussed ->
accepted/rejected -> done`) is still only advanced from
`/projects/improvements`.

One migration, generated via `pnpm db:generate` and applied with
`pnpm db:migrate`.

## Queries and mutations

- **`lib/data/meeting-notes.ts`** (`server-only`): `listMeetingNotes(query?)`
  — every meeting note, project chip data and a linked-improvement count
  joined in (no N+1), sorted `date` desc then `created_at` desc, optionally
  filtered by a case-insensitive `ilike` match across title, notes, and
  reflection (`sortMeetingNotes`/`aggregateLinkedImprovementCounts` are pure
  functions, unit-tested without a DB — mirrors `sortProjectSummaries`/
  `aggregateLinkedIdeaCounts` in `lib/data/projects.ts`). `getMeetingNote(id)`
  returns the row plus its linked project name, event, and improvements.
  `getMeetingNotesForProject(id)` backs the `ProjectMeetingNotes` sibling
  section on `/projects/[id]`. `searchAttachableEvents(query)` finds
  work-track events not already claimed by another meeting note.
  `searchLinkableImprovements(meetingNoteId, query)` finds improvements not
  yet linked to this meeting note.
- **`lib/meetings/actions.ts`**: `createMeetingNote` (date/title/notes
  required, type/reflection/project optional), `updateMeetingNoteDetails`
  (every field except the event and improvement links), `deleteMeetingNote`
  (hard delete — no archive concept here, unlike `projects`),
  `attachEventToMeetingNote`/`detachEventFromMeetingNote` (re-validates the
  work track and the one-meeting-per-event rule server-side, same shape as
  `attachEventToStream`/`detachEventFromStream`),
  `linkImprovementToMeetingNote`/`unlinkImprovementFromMeetingNote`
  (idempotent join-row insert/delete). Every action calls `verifySession()`
  first.
- **`lib/meetings/meeting-note-schema.ts`**: Zod schemas for capture, detail
  edits, and the two link pairs.

## UI

Mobile-first. Meeting notes are **work-track** content (unlike the
track-agnostic `projects`/`improvements`): any track-identifying surface —
the list card's border/hover, the detail header's marker — uses
`track-work` tokens plus the `Briefcase` icon and a "Work" label, per
`docs/design-system.md`.

- **List (`/projects/meetings`)**: `MeetingNoteCapture` is an inline card at
  the top — date (defaulting to today), title, and notes are always visible
  (the "enough to capture" set); type, reflection, and the optional project
  link are revealed once the user starts typing, same progressive-disclosure
  trigger as `ImprovementCapture`. `MeetingSearch` is a URL-driven (`?q=`),
  debounced search box, mirroring `IdeaFilters`'s search half. `MeetingNoteCard`
  shows the date (mono), type badge, a reflection snippet, and chips for the
  linked project/event/improvement count.
- **Detail (`/projects/meetings/[id]`)**: `MeetingNoteDetailHeader` (work-track
  marker, type badge, delete). `MeetingNoteDetailsForm` covers every editable
  field, with a Write/Preview toggle for notes (`MarkdownContent` — extracted
  from `ProjectNotes`'s preview tab into `components/shared/markdown-content.tsx`
  so both features share one renderer instead of two). `MeetingNoteEventSection`
  and `MeetingNoteImprovementsSection` are read/attach sections for the linked
  event and improvements, each with their own searchable attach picker
  (`MeetingEventAttachPicker`/`ImprovementAttachPicker`, mirroring
  `EventAttachPicker`/`IdeaAttachPicker`'s `Dialog` + filtered `Input` pattern).
  Deleting asks for confirmation (`DeleteMeetingNoteDialog`, mirrors
  `DeleteStreamDialog`) — a hard delete, since there's no archive concept here.
- **Entry points**: `/projects` links to `/projects/meetings`, and
  `/projects/[id]` gets a read-only `ProjectMeetingNotes` sibling section
  (next to `ProjectLinkedIdeas`/`ProjectImprovements`) listing linked
  meeting notes with a way in; editing happens on the meeting note's own
  detail page, not there.

## Test strategy

- **Unit**: `meeting-type.test.ts` (vocabulary + guard),
  `meeting-note-schema.test.ts` (validation edges),
  `lib/data/meeting-notes.test.ts` (the pure sort/aggregate helpers, plus
  mocked-DB query tests), `lib/meetings/actions.test.ts` (mocked DB, mirrors
  `lib/improvements/actions.test.ts`), and component tests for the capture
  form, details form (including the notes Write/Preview toggle), card,
  search, event/improvement sections and their attach pickers, the delete
  dialog, the detail header, and the `ProjectMeetingNotes` sibling section.
- **e2e**: `e2e/meetings.spec.ts` — quick-add shows up on the list; editing
  persists across reload; linking a project at capture shows the chip and
  the note on the project's page; search finds a note by title and by notes
  body, with an empty state for no matches; linking an improvement shows it
  on the meeting note and can be unlinked; attaching a work-track event shows
  it and can be detached; deleting removes it from the list. Skipped without
  `DATABASE_URL`, same as `improvements.spec.ts`. Runs under the `chromium`
  Playwright project only — added to `playwright.config.ts`'s
  `mobile-chrome` `testIgnore` list alongside `improvements.spec.ts`, since
  both seed/create/clear real rows in the shared dev database.
