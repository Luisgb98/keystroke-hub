# GitHub issue linking

Issue #27. Attaches a GitHub issue (or PR) to a project, improvement, or
meeting note — the app plans the work, GitHub tracks the execution, and this
keeps the two pointing at each other. Depends on #24, #25, #26, all of which
are live on `develop`.

Read-only, always: the only GitHub traffic this feature makes is `GET
/repos/{owner}/{repo}/issues/{number}` — the app never creates, comments on,
or closes anything on GitHub.

## Data model

One new table, `github_issue_links` (migration `0015`):

| Column                                              | Notes                                                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `project_id` / `improvement_id` / `meeting_note_id` | Three nullable FKs, `onDelete: "cascade"` — a `CHECK (num_nonnulls(...) = 1)` enforces exactly one is set |
| `owner`, `repo`, `issue_number`                     | The source of truth — what the user pasted, or the canonical casing GitHub returned                       |
| `title`, `state`, `fetched_at`                      | Best-effort cached metadata snapshot — all null until the first successful fetch                          |

Three nullable FKs plus a CHECK is real referential integrity Postgres can
enforce, unlike a polymorphic `target_type`/`target_id` pair. A composite
unique constraint across nullable columns wouldn't dedupe (Postgres treats
NULLs as distinct), so instead there's one **partial unique index** per
target column, e.g.:

```sql
CREATE UNIQUE INDEX github_issue_links_project_unique
  ON github_issue_links (project_id, owner, repo, issue_number)
  WHERE project_id IS NOT NULL;
```

The same issue linked to two _different_ items is allowed; linking it twice
to the _same_ item is not. The GitHub URL
(`https://github.com/{owner}/{repo}/issues/{n}`) is always derived, never
stored — GitHub's `/issues/{n}` path redirects to `/pull/{n}` when `n` is a
PR, so pasting a PR link works without a separate "kind" column, and a
merged PR is simply rendered as `closed` (its own API state).

## Queries and mutations

- **`lib/github/parse.ts`** (pure, no imports): `parseGithubIssueRef(input)`
  accepts a full `https://github.com/owner/repo/issues/123` (or `/pull/123`)
  URL or the `owner/repo#123` shorthand, validates GitHub's own
  owner/repo character rules, and returns a typed `{ ok, ref | error }` —
  never throws. `formatGithubIssueRef`/`githubIssueUrl` round-trip a ref
  back to display text / a URL.
- **`lib/github/api.ts`** (`server-only`): `fetchIssueMetadata(owner, repo,
number)` — a thin `fetch` wrapper (no GitHub SDK needed for one GET),
  mirroring `lib/google/client.ts`'s shape. Distinguishes not-found /
  rate-limited / unreachable and always resolves rather than throwing, since
  a metadata failure must never block attaching. `GITHUB_API_BASE_URL`
  overrides the base URL (used by e2e's fake server); `GITHUB_TOKEN` is an
  optional bearer token that lifts the 60 req/h anonymous limit to 5000 and
  enables metadata for private repos.
- **`lib/github/actions.ts`** (`"use server"`): `attachGithubIssue(target,
ref)` / `detachGithubIssue(linkId)` / `refreshGithubIssueLink(linkId)`.
  `target` is a discriminated union (`{ type: "project" | "improvement" |
"meetingNote", id }`) validated against the matching table — one shared
  action triple instead of three near-identical copies per host entity.
  Attaching re-checks the archived-project guard (`checkLinkableTarget`,
  same shape as `checkLinkableProject` elsewhere). Metadata is fetched
  best-effort at attach time; a failed fetch still attaches the link, just
  with `title`/`state` left null. Re-attaching an issue already linked to
  the same item is an idempotent success. Every action calls
  `verifySession()` first and revalidates only the one page that renders
  that target's links.
- **`lib/data/github-links.ts`** (`server-only`):
  `listGithubIssueLinksForProject(id)` / `...ForMeetingNote(id)` back the
  single-entity detail pages; `listGithubIssueLinksForImprovements(ids)` is
  the batched (no N+1) form backing the `/projects/improvements` list, same
  shape as `getLinkedIdeaSummariesForEvents` in
  `lib/data/idea-event-links.ts`.

## UI

Mobile-first, one pair of shared components used by all three host
surfaces:

- **`GithubIssueLinkSection`** — a compact "paste a GitHub issue URL or
  owner/repo#123" input ("Link issue" button, inline error copy on an invalid ref —
  no picker dialog, since attaching is pasting a reference rather than
  choosing from a list) plus the chip list. `disabled` hides the input
  (used when the host project is archived); `compact` tightens spacing for
  the improvement card's inline surface.
- **`GithubIssueChip`** — `owner/repo#123`, the cached title (truncated with
  a tooltip for the full text), and an open/closed state dot. Color is never
  the only signal: the dot pairs a `CircleDot`/`CircleCheck` icon with an
  `sr-only` "Open"/"Closed" label (`--success` for open, `--primary` — this
  app's existing purple hue — for closed, `CircleHelp` + "State unknown"
  when the metadata snapshot is null). The whole chip opens GitHub in a new
  tab; a small refresh icon re-fetches title/state on demand; removing a
  link toasts with an "Undo" action, same pattern as
  `MeetingNoteImprovementsSection`'s unlink.

**Mounted on:**

- `/projects/[id]` — a `GithubIssueLinkSection` sibling section after
  `ProjectMeetingNotes`, `disabled` when the project is archived.
- `/projects/meetings/[id]` — a `GithubIssueLinkSection` sibling section
  after `MeetingNoteImprovementsSection`.
- `/projects/improvements` — improvements have no detail page, so each
  `ImprovementRow` card mounts a `compact` `GithubIssueLinkSection` directly
  in its content, backed by the batched improvement query above.

## Open questions, resolved

1. **PR URLs** — accepted; a merged PR renders as `closed` (see Data model).
2. **Metadata freshness** — attach-time snapshot plus a manual per-chip
   refresh action, not a background poll. Simplest honest behavior, no
   hidden latency; an auto-refresh-on-stale follow-up is cheap to add later
   if manual refresh proves annoying.
3. **Link counts on list surfaces** — out of scope for this issue; the
   sections above are detail-only.

## Test strategy

- **Unit (vitest)**: `lib/github/parse.test.ts` (URL forms, shorthand,
  trailing slashes/query strings, PR URLs, bad owner/repo/number, garbage
  input), `lib/github/api.test.ts` (mocked `fetch`: success, 404,
  403/429 rate-limit, network failure, canonical-casing pass-through),
  `lib/github/actions.test.ts` (mocked DB: auth gate, target validation,
  archived-project rejection, duplicate handling, metadata-failure-still-attaches),
  `lib/data/github-links.test.ts` (mocked DB, including the batched
  "for many" grouping), and component tests for `GithubIssueChip` /
  `GithubIssueLinkSection` (states, attach/detach, inline error display).
- **e2e (Playwright)**: `e2e/github-links.spec.ts` — attach by shorthand on
  a project detail page, chip renders and its href points at GitHub,
  multiple links per item, detach with undo, invalid input shows an inline
  error, and the metadata-unavailable fallback (plain `owner/repo#123`,
  "state unknown"). The metadata fetch happens server-side, so Playwright's
  page-level route interception can't reach it — `GITHUB_API_BASE_URL`
  points the Playwright web server at `e2e/support/fake-github-server.ts`
  instead, mirroring `fake-google-server.ts`. Runs under the `chromium`
  project only, added to `playwright.config.ts`'s `mobile-chrome`
  `testIgnore` list alongside `improvements.spec.ts`/`meetings.spec.ts`,
  since it seeds/clears real rows in the shared dev database.
