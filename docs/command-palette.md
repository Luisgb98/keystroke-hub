# Command palette & global search

Issue #29. A Cmd/Ctrl-K palette (plus a mobile entry point) that jumps
anywhere in the app and searches every content and work entity by
title/content, so navigation cost stays near zero as the app grows. Depends
on #15 (ideas/scripts), #21 (daily logs), and #24 (projects) for searchable
entities — all shipped by the time this landed, so the palette ships
complete in one PR: navigation, recents, and real content search together,
with no phased rollout.

## Data model

None. Search reads existing tables (`ideas`, `scripts`, `daily_logs` +
`daily_log_items`, `meeting_notes`, `projects`, `improvements`) via their
existing `updatedAt`/text columns — no migration.

## The provider contract

`lib/search/types.ts` defines the shape every entity maps its rows onto:

```ts
interface SearchResult {
  id: string;
  type:
    | "idea"
    | "script"
    | "daily-log"
    | "meeting-note"
    | "project"
    | "improvement";
  world: "work" | "content";
  title: string;
  snippet?: string;
  href: string;
  updatedAt: Date;
}
```

A future entity (e.g. streams) plugs in by adding a query + mapper to
`lib/data/search.ts` — palette UI never needs to change.

## Queries

**`lib/data/search.ts`** (`server-only`), one condition-builder + one
row-mapper pair per entity, mirroring `buildIdeaFilterCondition`
(`lib/data/ideas.ts`): `buildIdeaSearchCondition`/`mapIdeaToResult`,
`buildScriptSearchCondition`/`mapScriptToResult`,
`buildMeetingNoteSearchCondition`/`mapMeetingNoteToResult`,
`buildProjectSearchCondition`/`mapProjectToResult`,
`buildImprovementSearchCondition`/`mapImprovementToResult` — every one a
pure, DB-free function, unit-tested by rendering its SQL the same way
`ideas.test.ts` does. Matching is `ILIKE '%q%'` across each entity's
title/body fields (see the table below); no unified search table or
Postgres FTS — single-user data volume makes per-table `ILIKE` fine, same
call `docs/content-ideas.md` made.

| Entity        | Fields matched                              | Result href                     | World   |
| ------------- | ------------------------------------------- | ------------------------------- | ------- |
| Ideas         | `title`, `notes`                            | `/content/ideas/[id]`           | content |
| Scripts       | `content`                                   | `/content/ideas/[id]` (parent)  | content |
| Daily logs    | `daily_logs.retro`, `daily_log_items.title` | `/journal?date=<logDate>`       | work    |
| Meeting notes | `title`, `notes`, `reflection`              | `/projects/meetings/[id]`       | work    |
| Projects      | `name`, `description`, `notes`              | `/projects/[id]`                | work    |
| Improvements  | `title`, `rationale`, `outcome`             | `/projects/improvements` (list) | work    |

Scripts have no detail route of their own, so a match links to the parent
idea but keeps its own `type: "script"` so the palette labels it distinctly
from an idea match. Improvements have no detail route either — every
improvement result links to the backlog list.

**Daily logs** are the one multi-source entity: a query can match the day's
retro _and_ an item's title independently, so `mergeDailyLogMatches`
(pure, unit-tested) dedupes both result sets down to one row per
`logDate`, keeping whichever candidate is more recently updated.

**`searchEntities(query)`** runs all six entity queries in `Promise.all`,
each capped at 5 rows, and returns a `SearchResultGroups` object (one array
per entity) — the palette renders one `CommandGroup` per non-empty key.

**`getRecentItems(limit = 8)`** — "recently updated", server-side: every
searchable table already carries `updatedAt`, so this fetches the top 5 per
entity and merges them cross-entity via the pure `mergeRecentCandidates`,
capped to 8 total. Chosen over client-side "recently visited" (localStorage)
because it needs no tracking infrastructure and works identically from any
device.

**`lib/search/navigation.ts`** — `secondaryNavItems` extends `navItems`
(`lib/navigation.ts`, the sidebar/bottom-nav source of truth) with
destinations that have no primary nav slot: `/inbox` (track-neutral, added by
#30), `/journal/week`, `/journal/standup`, `/content/ideas`, `/content/board`,
`/content/streams`, `/projects/improvements`, `/projects/meetings`,
`/settings/calendars`, each
tagged with an optional `world` (primary nav items stay track-agnostic,
matching `docs/design-system.md`'s rule that only genuinely single-track
things get a track color). `filterNavItems` is a pure case-insensitive
substring match — the palette's `Command` root runs with
`shouldFilter={false}` (server results are already filtered; letting cmdk
re-filter them with its own fuzzy matcher could silently drop true
matches), so navigation filtering happens here instead of relying on cmdk's
default behavior.

## Actions

**`lib/search/actions.ts`**: `searchAll(query)` — session-guarded like every
other action, short-circuits to empty result groups for a blank/whitespace
query before touching the database, otherwise delegates to `searchEntities`.
`getRecentPaletteItems()` — session-guarded wrapper around `getRecentItems`.

**Palette actions** (added by #30) — beyond Navigate/search results, the
palette renders an **Actions** group for things that _do_ something rather
than navigate. The first is **Capture a thought**, which closes the palette
and dispatches the `keystroke:open-capture` window event to pop the global
quick-capture dialog (`docs/inbox.md`) — a decoupled trigger, so the palette
needs no capture context. Actions are filtered by the same case-insensitive
label match as nav items.

## UI

- **`CommandPaletteProvider`** (`components/command-palette/`) — a client
  context mounted in `app/(app)/layout.tsx`, inside the auth-gated shell
  only (the palette must not exist on `/login`). Owns `open` state and the
  global `keydown` listener for Cmd/Ctrl-K, calling `preventDefault` before
  a browser's own binding (e.g. Chrome's address-bar focus) can act.
  `useCommandPalette()` exposes `{ open, setOpen }` to any trigger.
- **`CommandPalette`** — the dialog itself, built on shadcn's `command.tsx`
  (`cmdk`, added via `pnpm dlx shadcn@latest add command`) rendered inside
  our existing `Dialog`. Before typing: a **Recent** group (fetched once per
  open) plus a **Navigate** group listing every destination. While typing:
  Navigate narrows to label matches, and one `CommandGroup` per entity type
  appears as `searchAll` resolves (200ms debounce, plus a monotonic request
  counter so a slow, stale response can never overwrite a faster, newer
  one — server actions have no abort signal). Loading shows two skeleton
  rows rather than a layout jump; no matches at all render `CommandEmpty`.
  Selecting any item closes the dialog and `router.push`es its `href`.
- **`PaletteTriggerChip`** / **`PaletteSearchButton`**
  (`palette-trigger.tsx`) — the sidebar's `⌘K`/`Ctrl K` chip (Mac detection
  via a `useSyncExternalStore`-based hook, resolved client-only so the
  server-rendered chip never mismatches the hydrated one — same idiom as
  `theme-toggle.tsx`'s `useMounted`) and the bottom-nav's `Search` button
  (a 6th slot, styled like `NavLink`'s `"bottom"` variant).
- **Every result row** shows its world three ways — a track-colored icon
  chip (`TRACK_ICON`/`TRACK_SURFACE_CLASSES`, `components/calendar/track-styles.ts`,
  the same source every calendar chip uses), plus a visible `"Work"`/`"Content"`
  text label paired with the entity type caption (e.g. `"Content · Idea"`) —
  color is never the only signal, per `docs/design-system.md`.

## State management notes

Two effects that would otherwise call `setState` synchronously in their
body (resetting on close, clearing results when the query goes blank) are
instead handled during render via the "adjust state when a value changes"
idiom already used by `MeetingSearch`'s `prevValue` handling — comparing
against a tracked previous value and conditionally calling `setState`,
which bails out immediately rather than cascading. This keeps
`react-hooks/set-state-in-effect` happy and avoids an extra render pass.

## Test strategy

Unit (Vitest + RTL, colocated):

- `lib/search/navigation.test.ts` — every nav destination present with the
  right href/label/world, `filterNavItems`'s substring matching.
- `lib/data/search.test.ts` — `truncateSnippet`, every
  `buildXSearchCondition` (SQL text via `PgDialect`, mirrors
  `ideas.test.ts`), every `mapXToResult`, `mergeDailyLogMatches`,
  `mergeRecentCandidates`.
- `lib/search/actions.test.ts` — `verifySession` is called, a blank query
  short-circuits without calling `searchEntities`, a real query is trimmed
  and forwarded.
- `command-palette-provider.test.tsx` — Cmd-K and Ctrl-K both toggle open,
  `preventDefault` is called, the listener is removed on unmount.
- `command-palette.test.tsx` — groups render with world label + icon per
  result, selecting an item closes the dialog and calls `router.push` with
  its href (mocked `next/navigation` and `lib/search/actions`), a
  stale/out-of-order response never overwrites a newer one.

e2e (`e2e/command-palette.spec.ts`, Playwright, `chromium` + a
`test.use`-scoped mobile-viewport describe block — same pattern as
`ideas.spec.ts`'s mobile describe, so this file is added to the
`mobile-chrome` project's `testIgnore` in `playwright.config.ts`):

- Ctrl/Cmd-K opens the palette; typing a nav label filters to it; Enter
  navigates. Doesn't need `DATABASE_URL` (pure navigation).
- Esc closes the palette and returns focus to the trigger that opened it.
- Empty query shows the Navigate group immediately.
- Tapping the bottom-nav Search button (mobile viewport) opens the palette
  and a tapped result navigates.
- DB-backed: seeding one project (work) and one idea (content) sharing a
  token and searching for it surfaces both, each labeled with its world —
  skipped without `DATABASE_URL`, same guard as every other DB-backed spec
  (`docs/database.md`).
