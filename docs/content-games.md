# Game library

Issue #105. Almost every video and stream is _about_ a specific game, but the
game only ever existed as words inside a title or the prep notes — "PoE 3.29
league start", "Path of Exile 3.29", "poe league". Nothing could be grouped or
counted by game, and typing the name every time guaranteed the spellings drifted
apart, which is exactly what made the grouping impossible later.

This is the library, the tagging, and finding work by game. Per-game counts and
stats views can build on top of it.

## Why a table and not a tag

Ideas already carry free-form `tags` (see [content-ideas](content-ideas.md)),
whose filter options are derived from what's in use rather than from a
normalized table. The game is deliberately **not** one of those:

- **Tags describe a video for publishing; the game says what the work is
  about.** They answer different questions and belong in different fields.
- A tag is a string, so two spellings are two tags forever. A game is a **row
  with a stable id**, so renaming it rewrites one row and every idea and stream
  pointing at it reads the new name immediately — propagation is structural,
  not a migration.

## Data model

One table plus one nullable FK on each of the two things that can carry a game
(`lib/db/schema.ts`):

| Table     | Column               | Notes                                                     |
| --------- | -------------------- | --------------------------------------------------------- |
| `games`   | `id`, `name`         | one row per game; `created_at`/`updated_at` as everywhere |
| `ideas`   | `game_id` `uuid` nul | FK → `games.id`, `ON DELETE SET NULL`, indexed            |
| `streams` | `game_id` `uuid` nul | same shape, same rule                                     |

`name` is stored **trimmed and whitespace-collapsed exactly as typed** —
casing preserved, so the library shows "Path of Exile", not "path of exile".
The uniqueness guarantee is a unique index on `lower(name)`
(`games_name_lower_unique`), which is what makes "poe league", "PoE League" and
"&nbsp;&nbsp;poe&nbsp;&nbsp;league&nbsp;" collide **at the DB level** rather
than only in the action. A second copy of a game is impossible however it's
spelled.

Both `game_id` columns are nullable with `ON DELETE SET NULL`. That single
choice delivers three of the issue's acceptance criteria at once:

- an idea or stream **without** a game stays valid,
- every row predating the column keeps working, untouched, with no game set,
- **deleting a game untags** its ideas and streams — it never deletes them, and
  never leaves one pointing at a row that isn't there.

Migration `0020` adds the table, both columns, both FKs and both indexes. No
backfill: every existing row is simply untagged.

## Normalization, in exactly one place

`lib/content/game-schema.ts` owns the rules:

- `normalizeGameName` — trim, collapse internal whitespace, cap at 80 chars.
- `sameGameName` — normalize both sides, then compare case-insensitively.

Both are pure and shared by the picker (which decides client-side whether what
you typed is already an entry) and the actions (which decide server-side
whether to insert or hand back the existing row). One rule, so the two can't
drift apart and disagree about what counts as a duplicate.

## Queries and mutations

`lib/data/games.ts` (server-only):

| Function            | For                                                                      |
| ------------------- | ------------------------------------------------------------------------ |
| `getGames`          | the whole library, case-insensitively alphabetical — feeds every picker  |
| `getGamesById`      | the same list keyed by id, for rendering a chip behind a row's `game_id` |
| `getGamesWithUsage` | library + per-game idea/stream counts, for the library page              |
| `getGameUsage`      | one game's counts, read at delete-confirmation time                      |
| `resolveGameId`     | narrows a client-supplied id to one that really exists, or `null`        |

The library is deliberately **unpaginated**: it's a hand-curated list for one
person, so the picker filters the whole thing in the browser rather than
round-tripping per keystroke.

`getGamesWithUsage` uses correlated subqueries rather than two `GROUP BY`
joins — a game with no ideas but two streams still has to come back as `0`/`2`,
which an inner join would drop and a double left join would double-count.

`lib/content/game-actions.ts`:

- **`createGame`** — adding a name that already exists is a **success returning
  the existing row**, not an error. The picker calls this the moment you type a
  name it doesn't recognise, so "PoE league" against an existing "poe league"
  must simply select that entry. A lost race on the unique index falls back to
  a re-read rather than surfacing a constraint violation.
- **`renameGame`** — one `UPDATE`. Renaming _onto_ another entry is rejected
  rather than silently merging the two (merging would retag work the user never
  asked to move); re-casing an entry to itself is allowed, since that's a
  correction.
- **`deleteGame`** — deletes only the library row. Untagging is the FK's job,
  so no code path here can touch an idea or a stream.

All three revalidate `/content` as a **layout**, not a list of routes: a
rename has to reach the ideas list, the board, the streams list and both detail
routes, and enumerating them is how one gets forgotten.

`resolveGameId` runs on every write that carries a `game_id`. A stale id — the
game was deleted in another tab while the dialog sat open — degrades to "no
game" rather than failing the whole save on a foreign-key violation, and
re-reading from a trusted source is what the server-actions data-security guide
asks for anyway.

## The picker

`components/content/games/game-picker.tsx` — a themed `Popover` + `cmdk`
`Command`, not a native `<select>`:

- **Searchable first.** Typing filters the library by substring, so "exile"
  reaches "Path of Exile" — a few keystrokes rather than a scroll. The rule is
  the exported, unit-tested `filterGames`, run with `shouldFilter={false}`
  (cmdk's own fuzzy scoring would re-order and silently drop matches — the same
  reasoning as [command-palette](command-palette.md)).
- **Add it right there.** When what's typed isn't in the library, an "Add …"
  row replaces the empty state and creates the entry without leaving the page,
  then selects it. `canAddGame` hides that row whenever the name already
  exists under any casing or spacing, so the add path can't produce a duplicate
  even before `createGame`'s own guard.
- **Empty library is not a dead end.** With no games at all, the popup invites
  adding the first one instead of showing "no results".
- **Clearing is a row**, not a hidden gesture: "No game" sits at the top
  whenever something is picked.
- **Themed popup.** The surface is `bg-popover`, so it follows the app theme in
  both light and dark mode rather than rendering an OS-default white sheet.
- **Keyboard and screen reader.** cmdk carries the combobox/listbox/option
  roles and the arrow-key loop; the search field takes focus on open via Base
  UI's `initialFocus`. The field is named by `Command`'s `label` prop — cmdk
  points the input's `aria-labelledby` at the visually-hidden label it renders
  from that prop, and it **wins over an `aria-label` on the input**, so without
  it the field would have no accessible name at all.
- **One-handed on mobile.** Every row carries a `min-h-9` floor: the shared
  command-item row is ~20px tall, which is fine for a keyboard-driven palette
  and too small for a thumb.

A game added from the picker is merged into a local list until the parent's
`games` prop refreshes — `revalidatePath` round-trips after the action, which a
dialog that's still open would otherwise sit ahead of.

## Where a game shows and how it's set

| Surface              | Shows the game                                  | Sets it                            |
| -------------------- | ----------------------------------------------- | ---------------------------------- |
| Idea card            | chip → filtered list                            | via the edit dialog                |
| Idea detail page     | chip → filtered list                            | via the edit dialog                |
| Idea capture/edit    | —                                               | picker, saved with everything else |
| Stream card          | chip (plain — the whole card is already a link) | —                                  |
| Stream detail page   | picker                                          | picker, behind the page's one Save |
| Stream create dialog | —                                               | picker, saved with everything else |

The game is an ordinary field on the existing forms rather than its own inline
mutation: both surfaces already commit every field behind one Save (#102), and
a separate narrow mutation would make "what did that button just write?"
ambiguous again.

The chip links to `/content/ideas?game=<id>` wherever nesting a link is valid —
"everything I've made about this game" is one tap from wherever the game shows.

## Filtering ideas by game

A game row joins the format/status/tag chip rows on `/content/ideas`, with the
same mechanics as the rest (see [content-ideas](content-ideas.md)): the
selection lives in the URL (`?game=<id>`), so it **composes** with every other
filter, is shareable, and survives a reload. `buildIdeaFilterCondition` maps it
to a plain equality on `game_id`, `AND`ed with the others.

Filtering is by **id**, not name — a rename must not break a bookmarked view.

## The library page

`/content/games`, linked from the Content hub. Add, rename inline, delete.

Renaming is an inline field on the row rather than a dialog: it's a one-word
correction, and there's nothing else to confirm.

Deleting always confirms, and the confirmation **says what's about to be
untagged** ("2 ideas · 1 stream tagged with it will be untagged. Nothing is
deleted"). That usage is re-read from the server at the moment you ask rather
than taken from the counts already on screen, so the warning can't be stale.

## Test strategy

Unit (`vitest`):

- `game-schema` — normalization (trim/collapse/cap, casing preserved),
  `sameGameName` across casing and spacing, and the field schemas.
- `game-actions` — insert of the normalized name; duplicate selects the
  existing row instead of inserting; the lost-race re-read; rename writes one
  row and refuses to merge onto another entry; delete never touches ideas or
  streams.
- `lib/data/games` — bigint count coercion, `getGameUsage`, and
  `resolveGameId`'s three cases.
- `GamePicker` — `filterGames`/`canAddGame` as pure rules, plus the popup:
  search, empty library, add-new, duplicate rejection, clearing, and full
  keyboard operation (focus on open → type → arrow → Enter).
- `GameLibrary` — `usageLabel` pluralization, add/rename/Escape-to-abandon,
  and the delete confirmation as a real gate.
- The suites the field touches — idea card/editor/filters, stream
  card/details-form — are extended, not skipped.

E2E (`e2e/games.spec.ts`, DB-backed so it skips without `DATABASE_URL`, same as
the ideas and streams suites): tagging an idea and a stream (including adding a
game that doesn't exist yet), clearing a game, rename propagating to a card,
delete-in-use warning then untagging without deleting, duplicate-add staying at
one entry, filtering ideas by game alone and combined with the format filter
across a reload, and the whole picker flow at a phone viewport (focus on open,
tappable add row).

Each `describe` owns its own fixture prefixes — the blocks run in parallel
across workers, and a shared prefix would let one block's cleanup delete
fixtures another is still asserting on.
