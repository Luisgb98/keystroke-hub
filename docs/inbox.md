# Quick-capture inbox

Issue #30. One frictionless capture box for any thought, so nothing is lost
when there's no time to file it properly. A thought lands in a universal
inbox first — no category, no title, no required choice — and is triaged
later into wherever it belongs.

The inbox lives at `/inbox` inside the authenticated shell. Capture itself is
shell-wide: the dialog is mounted once in the `(app)` layout, so a thought can
be filed from anywhere — the command palette's **Capture a thought** action
(Ctrl/Cmd-F, then pick it) on any screen, or the Inbox page's own capture
button. Issue #85 retired the floating bottom-right dock that used to own that
job; the count now lives on the Inbox nav link, on both viewports.

## Why it's deliberately track-neutral

Every other entity in the app commits to a world: events/ideas/streams are
content, logs/meetings/improvements are work. Inbox entries are
**pre-classification** — the whole point is deferring that decision — so the
table carries no `track` discriminator and the inbox UI uses semantic tokens,
not work/content track colours. Track colour appears only on the **triage
destination options** (idea = content/Clapperboard-family; improvement, daily
log, meeting = work/Briefcase-family), per the icon + label + colour rule in
`docs/design-system.md`.

## Data model

One new table + enum in `lib/db/schema.ts` (migration `0016`):

| Table           | Columns (essence)                                                                    | Notes                        |
| --------------- | ------------------------------------------------------------------------------------ | ---------------------------- |
| `inbox_entries` | `id`, `body`, `triaged_at`, `triaged_to_type` (`inbox_destination`), `triaged_to_id` | one row per captured thought |

**`triaged_at IS NULL` means "still in the inbox".** Triage and discard both
stamp `triaged_at`; the list and the count both filter on `IS NULL`, so
triaged _and_ discarded entries leave the inbox by the same predicate. The
hot-path index is `(triaged_at, created_at)`.

**Entries are kept, not deleted.** "Leaving the inbox" is a filter, not a
`DELETE`, which preserves an audit trail of where each thought went — cheap
for a single-user app. `discarded` is a first-class `inbox_destination` value
(alongside the four real destinations) so junk is recorded, not erased.

**`triaged_to_id` has no FK.** It points into four different destination
tables (and is `NULL` for discards), which real referential integrity can't
express polymorphically — the same accepted trade-off as
`event_sync_links.google_event_id`.

## Server actions (`lib/inbox/actions.ts`)

- **`captureEntry`** — `FormData`-shaped, body-only. Validates with
  `captureBodySchema` (whitespace-only rejected, ~2,000-char cap) and inserts.
  Everything else about the entry is deferred.
- **`triageEntry(entryId, payload)`** — validates `payload` against
  `triagePayloadSchema` (a discriminated union that reuses each destination's
  own field rules), then inserts the destination record and stamps the entry
  `triaged_*` **in one `db.batch()`**. Batching is the closest the neon-http
  driver gets to a transaction (no interactive `db.transaction()`, same
  constraint as `createStream`), so an entry can never be duplicated into a
  destination while remaining in the inbox, nor vanish without one.
  Destination ids are generated in the action so the created id can be both
  recorded on the entry and returned within the single batch. A guard reads
  the entry first and refuses a missing/already-triaged one; the update also
  carries an `IS NULL` predicate as belt-and-braces against the (single-user,
  unlikely) concurrent case.
- **`discardEntry(entryId)`** — stamps `triaged_at` + `triaged_to_type =
'discarded'`, no destination.

All three call `revalidatePath("/(app)", "layout")` (refreshes the count
badge everywhere, since the count is read in the `(app)` layout) plus the
affected listing paths.

### Triage field mapping (prefill)

The captured text maps to the destination's most natural field
(`lib/inbox/prefill.ts`, pure + unit-tested):

| Destination      | Title                   | Secondary field           | Notes                                            |
| ---------------- | ----------------------- | ------------------------- | ------------------------------------------------ |
| Content idea     | first line              | `notes` = remaining lines |                                                  |
| Improvement      | first line              | `rationale` = remaining   |                                                  |
| Today's log item | whole body, single-line | —                         | lands on **today's** log as `planned` (lazy log) |
| Meeting note     | empty (user names it)   | `notes` = whole body      | date defaults to today                           |

The daily-log destination reuses `getOrCreateLog` (lazy log creation, same as
`addItem`). The raw entry text stays **read-only in the inbox** — editing
happens in the prefilled triage form, keeping the inbox dumb.

## UI

- **`components/inbox/inbox-capture-provider.tsx`** — owns the single, app-wide
  capture dialog (mounted in the `(app)` layout, never on `/login`). Exposes
  `openCapture()` to client descendants and also opens on a global
  `keystroke:open-capture` window event, dispatched via `requestOpenCapture()`
  — a decoupled trigger with no shared context, used by both the command
  palette's action and `inbox-capture-button.tsx`.
- **`capture-dialog.tsx`** — just an autofocused textarea + Save. ⌘/Ctrl+Enter
  submits; a `sonner` toast confirms; the field clears and the dialog closes.
- **`inbox-capture-button.tsx`** — the Inbox page's own capture button. `/inbox`
  is a server component, so this thin client button just calls
  `requestOpenCapture()` rather than owning a dialog.
- **`entry-card.tsx`** — body + relative timestamp, a Triage menu (four
  destinations) and a discard action (with an `alert-dialog` confirm).
- **`triage-dialog.tsx`** — the destination-specific step, prefilled; a focused
  subset of the destination's own form, not the whole thing.
- **Nav** carries the Inbox link and its count on both viewports: the sidebar
  on desktop, the bottom nav on mobile, both rendering the shared
  `components/shell/inbox-count-badge.tsx`. The badge is `aria-hidden` and the
  link is named via `NavLink`'s `badgeLabel` ("Inbox, 3 to triage"), because the
  bottom variant sits the pill on the tab icon — _before_ the label in DOM
  order — which would otherwise be announced as "3Inbox". The command palette
  lists **Inbox** (Navigate) and **Capture a thought** (Actions).

### Nav placement (revised by #85)

Originally the inbox stayed out of the dense mobile bottom nav and rode the
floating dock instead. #85 removed that dock — it didn't fit the app's design
and got in the way on every page — which left mobile with no persistent inbox
entry point, since the sidebar is `hidden md:flex`. So the bottom nav gained an
Inbox tab (count badge included) after all, and capture-from-anywhere moved to
the command palette action, with a dedicated button on the Inbox page itself.

## Tests

- **Unit (Vitest, colocated):** `entry-schema` (empty/whitespace rejected,
  length cap, per-destination payload rules); `prefill` (title/remainder
  splitting, per-destination mapping); `queries` (untriaged filter + count
  unwrap); `actions` (capture happy/validation, `triageEntry` field mapping
  for all four destinations, atomic batch of insert + update, missing/
  already-triaged guards, discard). Components: capture dialog (autofocus,
  ⌘+Enter, clears/closes on success, validation error), entry card (four
  destinations, prefilled triage dialog, discard confirm), triage dialog
  (prefill, payload shape, error), inbox capture button (dispatches the
  open-capture event, owns no dialog), inbox count badge (renders the count,
  silent at zero, `aria-hidden`), bottom nav (Inbox tab present, active on
  `/inbox`, count in the link's accessible name).
- **e2e (`e2e/inbox.spec.ts`, Playwright, `chromium` + a `test.use`-scoped
  mobile-viewport describe — so the file is in the `mobile-chrome`
  `testIgnore` in `playwright.config.ts`):** capture from a non-inbox page in
  two taps → entry visible + badge increments; triage into a content idea and
  onto today's log (prefill verified, entry gone, record exists at the
  destination); discard with confirm; capture via the command palette; capture
  via the Inbox page button; the dock is absent on desktop and mobile (no
  floating capture button, exactly one Inbox link); and, at a mobile viewport,
  one-handed capture through bottom-nav Search → the palette action, then the
  bottom nav's Inbox tab showing the fresh count and reaching the list. Skipped
  without `DATABASE_URL`, same guard as every other DB-backed spec
  (`docs/database.md`). The dock-absent and bottom-nav-Inbox checks that need
  no database live in `e2e/shell-navigation.spec.ts`.
