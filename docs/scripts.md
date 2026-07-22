# Markdown script editor with rendered view

Issue #17. A Markdown script editor for a video/stream idea, with autosave
and a polished, distinct rendered reading view for use while recording.

## Data model

One table, `scripts` (`lib/db/schema.ts`), separate from `ideas` rather than
a column on it — a script is optional, created lazily on first save, and
`unique(idea_id)` is what enforces "a script attaches to exactly one idea" at
the schema level (it's also the upsert's conflict target).

| Column                      | Type                                 | Notes                                  |
| --------------------------- | ------------------------------------ | -------------------------------------- |
| `id`                        | `uuid` PK, default random            |                                        |
| `idea_id`                   | `uuid` **not null**, FK → `ideas.id` | `on delete cascade`, unique            |
| `content`                   | `text` not null, default `''`        | raw Markdown                           |
| `created_at` / `updated_at` | `timestamptz` not null               | `updated_at` drives the save indicator |

`on delete cascade`: deleting an idea deletes its script too, matching the
existing hard-delete precedent (`docs/content-ideas.md`). `DeleteIdeaDialog`
shows one extra warning sentence when the idea being deleted has a script.

No status/versioning columns — a script's lifecycle is the idea's pipeline
`status` (already `scripted` → `recorded` → …), not its own state. Saving a
script does **not** auto-advance the idea's status; the owner still drives
that via the existing card/board controls.

## Creating a script

There's no separate "create script" step. The script page always exists for
any idea (an idea without one just shows an empty editor), and the first
save is what inserts the row — `saveScript` (`lib/content/script-actions.ts`)
is a single upsert keyed on `idea_id` (`insert ... onConflictDoUpdate`) for
every save, first or subsequent. Since #71, the idea capture dialog
(`IdeaEditor`) can also seed the script inline at creation time (a plain
`insert` against the brand-new idea); the dedicated editor page below remains
the surface for editing it afterwards.

## Route & data access

- **Route**: `app/(app)/content/ideas/[id]/script/page.tsx` — the first
  per-idea page in the app (ideas otherwise live entirely as cards, no detail
  view). Shows the not-found UI via `notFound()` for an unknown idea id.
  Because the route has a `loading.tsx`, the response is already streaming
  (HTTP 200) by the time `notFound()` resolves, so the wire status stays 200
  even though the not-found page renders — a documented Next.js tradeoff
  (see the "Status Codes" note in
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`),
  acceptable for a private, unindexed single-user app; e2e asserts the
  rendered not-found UI, not the status code. Unlike the ideas list and
  board, this page does **not** have the "render on a missing database"
  resilience contract (`docs/database.md`) — it's only reachable from a
  card's script link, not primary navigation, and there's nothing useful to
  show without the idea it's attached to.
- **Read**: `getIdeaWithScript` (`lib/data/scripts.ts`) — the idea (so the
  page can 404) plus its script, if one has ever been saved.
  `getIdeaIdsWithScripts` returns the set of idea ids with a _non-empty_
  saved script — feeds the "has script" indicator on `IdeaCard`/`BoardCard`
  (an empty-string script, e.g. one cleared back to nothing, doesn't count).
- **Write**: `saveScript(ideaId, content)` in `lib/content/script-actions.ts`
  — `verifySession()`, then re-reads the idea by id from the trusted server
  session rather than accepting anything but the id + content from the
  client (see the Server Actions data-security guide), validates via
  `scriptSaveSchema` (`lib/content/script-schema.ts`, a generous 200,000
  character cap so a runaway paste can't create a megabyte row), then
  upserts and revalidates the script page plus both idea surfaces (ideas
  list, board) since they render the "has script" indicator.

## Editor & autosave

`ScriptEditor` (`components/content/script/script-editor.tsx`), a Client
Component:

- **Write surface**: the existing `components/ui/textarea.tsx`
  (auto-growing via CSS `field-sizing`) — deliberately not a rich/code
  editor. Native selection and keyboard, zero per-keystroke JS layout, which
  is what keeps a multi-thousand-word script smooth on mobile.
- **Autosave**: a 1.8s debounce after the last keystroke, calling
  `saveScript` inside `useTransition`. Cmd/Ctrl+S and a Save button trigger
  an immediate save, bypassing the debounce. A `beforeunload` guard blocks
  closing the tab while a save is pending (`dirty`) or in flight (`saving`)
  — the "no lost work" acceptance criterion is enforced, not just described.
- **Save-state indicator**: `Unsaved changes` → `Saving…` → `Saved HH:MM`, or
  `Save failed — retry` (a button that retries with the current content, not
  the content at the time of the failed attempt) on error, which also toasts.
- **Write/Read modes**: `Tabs`, state reflected in the URL (`?view=read`) via
  `router.replace` — same "adjust local state during render when the URL
  prop changes externally" pattern as `IdeaFilters` — so a recording session
  can be bookmarked or reloaded straight into reading mode.

## Reading view

`ScriptReadingView` (`components/content/script/script-reading-view.tsx`)
renders Markdown via `react-markdown` + `remark-gfm`, **not**
`@tailwindcss/typography`'s `prose` classes — a component map styles every
element (`h1`–`h3`, paragraphs, lists, blockquote, inline/fenced code,
tables, links) with the design system's own type scale
(`text-h1`/`h2`/`h3`/`body`/`small`), so it stays visually part of the app
rather than opting into a separate typography system. `react-markdown`
doesn't render raw HTML by default, so no sanitization pipeline is needed.
Fenced code blocks carry a `language-*` class from the Markdown AST; inline
code never does — that's the only signal available (react-markdown v10
dropped the old `inline` prop) for styling the two differently.

## Entry points

`IdeaCard` and `BoardCard` both get a `ScrollText` icon-button link to
`/content/ideas/{id}/script`, labeled "Write script for …" or "Open script
for …" depending on `hasScript` (also tinted with the content-track
foreground color when a script exists, never color alone — the dual-track
rule in `docs/design-system.md`). Both `app/(app)/content/ideas/page.tsx` and
`app/(app)/content/board/page.tsx` fetch `getIdeaIdsWithScripts()` alongside
their existing idea query to compute this per card.

## Testing

Unit (Vitest + RTL): `script-schema` (max-length boundary), `script-actions`
(DB mocked — session check, idea-existence check, the upsert shape,
revalidation targets), `lib/data/scripts` (DB mocked), `script-editor`
(fake timers for the debounce/coalescing behavior, Cmd/Ctrl+S, the Save
button, retry-on-failure, the Write/Read URL sync, and the `beforeunload`
guard), `script-reading-view` (Markdown fixtures render mapped, token-classed
elements; inline vs. fenced code; raw HTML isn't rendered), plus the new
script-link assertions added to `idea-card`/`board-card`'s existing tests.

e2e (`e2e/scripts.spec.ts`, real DB via `e2e/support/ideas-db.ts` — a
script row cascades away with its idea, so no separate script fixture helper
is needed): writing autosaves and survives a reload, the Save button commits
immediately, Read mode renders and survives a reload with the URL intact,
reopening a saved script from the card shows the "Open" label, an unknown
idea id shows the not-found UI, and a mobile-viewport check that a long
script stays editable
with no horizontal overflow. Like `board.spec.ts`, excluded from the
`mobile-chrome` Playwright project (`playwright.config.ts`) since it
seeds/clears real rows and already covers its own mobile viewport via
`test.use`.
