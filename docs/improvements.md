# Improvements & proposals backlog

Issue #25. A running list of process and tooling improvements so retro and
improvement meetings start with a ready agenda instead of a blank page.
Lives under `/projects/improvements`, a sibling of the projects tracker
(#24) in the **Projects & Meetings** part of the app.

Direction of the #26 (meeting notes) dependency is inbound: meeting notes
will later reference improvements ("improvements discussed in the meeting
can be referenced"), so this issue introduces no meeting concept at all —
"outcome recorded after the meeting" is just an `outcome` text field plus a
status change on the improvement itself.

## Data model

One new table in `lib/db/schema.ts`:

| Table          | Columns (essence)                                                                                                   | Notes                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `improvements` | `id`, `title`, `rationale`, `status` (`proposed`/`discussed`/`accepted`/`rejected`/`done`), `outcome`, `project_id` | one row per improvement |

**Status is a lifecycle, not archival** — `accepted`/`rejected` are
terminal-ish and `done` is the end state, so unlike `projects` there's no
`archived_at`; the status itself answers "is this resolved?".

**`project_id`** is a plain nullable FK (`references(() => projects.id, {
onDelete: "set null" })`), the same one-to-many shape as `ideas.project_id`
(docs/projects.md) — an improvement belongs to at most one project. Unlike
ideas, it's settable directly at capture time (see UI below), not only via
a separate attach flow, since the plan called for an optional project
select in the expanded capture form.

No `discussed_at`/`decided_at` timestamps — `updated_at` plus `status`
cover the single-user need; a future meeting link (#26) will carry the
"which meeting" context properly.

## The status lifecycle

`proposed → discussed → accepted/rejected → done`, documented in
`lib/improvements/improvement-status.ts` and shaped into the UI, but
**not hard-enforced** — single-user app, corrections should be cheap, same
precedent as `updateProjectStatus`/`updateIdeaStatus`. The one guard: the
plain status quick-switch (`ImprovementStatusSelect`) only offers
`proposed`/`discussed`/`done` — `accepted`/`rejected` are reachable **only**
through `recordImprovementOutcome`, so recording an outcome is the one way
onto those two statuses. Moving an item back to `proposed` after a verdict
keeps its `outcome` text as visible history rather than clearing it.

## Queries and mutations

- **`lib/data/improvements.ts`** (`server-only`): `listImprovements()` —
  every improvement with its project chip data joined in (`leftJoin`, no
  N+1), split into `agenda` (status `proposed` only, oldest-first — the
  meeting-ready view) and `all` (pipeline order, then most-recently-updated
  within each stage). `sortImprovementsForAgenda`/`sortImprovementsForAll`
  are pure functions, unit-tested without a DB (mirrors
  `sortProjectSummaries` in `lib/data/projects.ts`). `agenda` is a
  **filter** of `all`, not a disjoint split like projects'
  active/archived — an item can be in both. `listLinkableProjects()` feeds
  the capture form's project select (non-archived projects only).
  `getImprovementsForProject(id)` backs the `ProjectImprovements` sibling
  section on `/projects/[id]`.
- **`lib/improvements/actions.ts`**: `createImprovement` (title required,
  rationale + project optional), `updateImprovementDetails`
  (title/rationale/project link together — editing the project link reuses
  this action rather than a separate `linkImprovementToProject`, since
  unlike ideas the project is chosen inline in the same form, not via a
  detail-page attach picker), `updateImprovementStatus` (rejects
  `accepted`/`rejected`), `recordImprovementOutcome` (sets status +
  outcome in one write). Every action calls `verifySession()` first and
  rejects linking to an archived project with the same message as
  `linkIdeaToProject`.
- **`lib/improvements/improvement-schema.ts`**: zod schemas for capture,
  detail edits, the plain status change, and the outcome write.

## UI

Mobile-first, neutral tokens only — improvements are a work-process
artifact but live in the track-agnostic Projects & Meetings world like
projects themselves.

- **List (`/projects/improvements`)**: `ImprovementCapture` is an inline
  card at the top, title-only by default — rationale and an optional
  project `Select` appear once the user starts typing, keeping capture
  near-frictionless (the issue's core "why"). `AgendaTabs` switches between
  **Agenda** (default — not-yet-discussed items, oldest first) and **All**;
  content is swapped below the `Tabs` control rather than rendered as two
  `TabsContent` panels, since an agenda item is also in `all` and mounting
  both at once would render it twice (same pattern as `ProjectNotes`'s
  Write/Preview toggle). `ImprovementRow` shows title, status badge,
  project chip (linking to the project), rationale snippet, the recorded
  outcome once decided, a plain status select, and a "Record outcome"
  button while unresolved. `RecordOutcomeDialog` captures the
  accepted/rejected decision and free-text outcome in one step.
- **Entry points**: `/projects` shows a small header link to the backlog
  with a live count of agenda items waiting. `/projects/[id]` gets a
  read-only `ProjectImprovements` sibling section (next to
  `ProjectLinkedIdeas`) listing linked improvements with their status;
  editing happens on `/projects/improvements`, not there.

## Test strategy

- **Unit**: `improvement-status.test.ts` (vocabulary + the
  selectable/outcome status split), `improvement-schema.test.ts`
  (validation edges), `lib/data/improvements.test.ts` (the pure
  sort/filter helpers, plus mocked-DB query tests), `lib/improvements/actions.test.ts`
  (mocked DB, mirrors `lib/projects/actions.test.ts`), and component tests
  for the capture form, status badge/select, outcome dialog, row, agenda
  tabs, and the project-detail sibling section.
- **e2e**: `e2e/improvements.spec.ts` — quick-add shows up on the agenda;
  linking a project at capture shows the chip and the item on the
  project's page; recording an outcome as accepted leaves the agenda and
  shows the outcome under All; an accepted item can be marked done; a
  rejected item stays off the agenda. Skipped without `DATABASE_URL`, same
  as `projects.spec.ts`. Runs under the `chromium` Playwright project only
  — added to `playwright.config.ts`'s `mobile-chrome` `testIgnore` list
  alongside `projects.spec.ts`, since both seed/clear real rows in the
  shared dev database and running them under both projects concurrently
  races the same fixtures.
