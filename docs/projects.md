# Projects tracker

Issue #24. A home for each ongoing project — status and running notes — so
project context isn't scattered across tools and memory. Projects are
deliberately **track-agnostic connective tissue**: the rest of
`epic:projects-meetings` (#25 improvements, #26 meeting notes, #27 GitHub
linking) and, from this issue, content ideas, all point at one.

## Data model

One new table in `lib/db/schema.ts`:

| Table      | Columns (essence)                                                                        | Notes               |
| ---------- | ---------------------------------------------------------------------------------------- | ------------------- |
| `projects` | `id`, `name`, `description`, `status` (`active`/`paused`/`done`), `notes`, `archived_at` | one row per project |

**Archival is `archived_at`, not a fourth status value.** Archival answers
"is this visible in day-to-day lists?"; `status` answers "where did this end
up?" — orthogonal questions, so a `done` project and a paused-then-abandoned
project can both be archived without losing what their status was. Per the
issue's acceptance criteria, **there is no delete action for projects at
all** — archive is the only way off the active list, so anything a project is
linked to always keeps its history.

**`ideas.project_id`** (added by #15, forward-compat, bare nullable `uuid`
with no FK) gets its real foreign key here:
`references(() => projects.id, { onDelete: "set null" })`, plus
`ideas_project_id_idx`. Every existing value was `NULL`, so no backfill was
needed. An idea belongs to **at most one project** — this is a plain nullable
column, not a join table, unlike idea<->event links (#18), because the
relationship is one-to-many rather than many-to-many.

No unique constraint on `projects.name` — a single-user app values renaming
freedom over collision errors.

## Queries and mutations

- **`lib/data/projects.ts`** (`server-only`): `listProjects()` — every
  project plus a batched linked-idea count (no N+1), split into
  active/archived and sorted active → paused → done, then most-recently-
  updated within each stage (`splitArchivedProjects`/`sortProjectSummaries`/
  `aggregateLinkedIdeaCounts` are pure functions, unit-tested without a DB —
  mirrors `bucketStreams`/`aggregateChecklistProgress` in
  `lib/data/streams.ts`). `getProject(id)` returns the row plus its linked
  ideas. `searchLinkableIdeas(query)` finds **unassigned** ideas (`projectId
is null`) — the picker deliberately doesn't offer ideas already on another
  project; reassigning is out of scope here. `getProjectSummariesForIdeas(ids)`
  batches project-chip data for `IdeaCard`.
- **`lib/projects/actions.ts`**: `createProject` (name required, everything
  else optional), `updateProjectDetails` (name/description), `updateProjectStatus`
  (a plain status change, no confirmation — cheap to change back, same
  precedent as `updateIdeaStatus`), `saveProjectNotes`, `archiveProject`/
  `unarchiveProject`, and `linkIdeaToProject`/`unlinkIdeaFromProject` (a
  column assignment, not a join-table insert — see above; linking to an
  archived project is rejected with a friendly error). Every action calls
  `verifySession()` first.
- **`lib/projects/project-schema.ts`**: zod schemas for capture, detail
  edits, status, notes, and the idea-link pair.

## UI

Mobile-first, no track color — projects belong to both worlds equally, so
they use only neutral tokens (`border-border`, `bg-muted`), never
`track-work`/`track-content`.

- **List (`/projects`)**: `ProjectCapture` is an inline card at the top of
  the flow (not a floating dialog) — a project is a rarer, more deliberate
  action than an idea or a stream. `ProjectCard` shows status badge,
  description snippet, and a linked-idea count. `ArchivedProjectsSection` is
  collapsed by default.
- **Detail (`/projects/[id]`)**: `ProjectDetailHeader` (status quick-switch +
  an overflow menu for archive/unarchive), `ProjectDetailsForm`
  (name/description), `ProjectNotes` (autosaving markdown with a Write/Preview
  toggle — a smaller-scale sibling of `ScriptEditor`), `ProjectLinkedIdeas`
  (the first concrete "linked items" section), and `ProjectImprovements`
  (#25's read-only sibling section — see docs/improvements.md; #26 adds its
  own sibling later without reworking either). Archived projects stay fully
  viewable but read-only-ish: every mutation besides "unarchive" is disabled.
- **Idea side**: `IdeaCard` shows a small read-only project chip (`Briefcase`
  icon + name, linking to the project) when an idea is linked. The primary
  write path is attaching from the project page via `IdeaAttachPicker`
  (mirrors `EventAttachPicker`/`IdeaLinkPicker`'s `Dialog` + filtered `Input`
  pattern) — there's no project picker on idea capture, keeping capture
  frictionless.

## Test strategy

- **Unit**: `project-status.test.ts` (enum guard), `project-schema.test.ts`
  (validation edge cases), `lib/data/projects.test.ts` (the pure
  sort/split/aggregate helpers above), `lib/projects/actions.test.ts` (mocked
  DB, mirrors `stream-actions.test.ts`), and component tests for the status
  badge/select, capture form, and archive dialog.
- **e2e**: `e2e/projects.spec.ts` — create a project, change its status, edit
  running notes and see them persist, link an idea and see it on both sides,
  archive (gone from the active list, visible under Archived, links intact),
  unarchive. Skipped without `DATABASE_URL`, same as `streams.spec.ts` (see
  docs/database.md).
