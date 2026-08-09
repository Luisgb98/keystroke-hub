# MCP server

The app exposes its **content world** as an MCP server, so any MCP-capable
assistant — Claude Code, Claude Desktop, an editor, an agent — can capture an
idea, write its script, move it down the pipeline, plan a stream and reschedule
a release without anyone opening the UI (issue #109).

**Work life is not reachable here.** Tasks, daily/weekly logs, meetings and
projects have no tool, and every calendar tool is content-track only. The
two-worlds separation this app is built on applies to machines as much as to
the interface.

## Endpoint

|           |                                                                               |
| --------- | ----------------------------------------------------------------------------- |
| URL       | `https://<your-deployment>/api/mcp` (locally `http://localhost:3000/api/mcp`) |
| Transport | Streamable HTTP (stateless — no session store, no Redis)                      |
| Auth      | `Authorization: Bearer $MCP_AUTH_TOKEN`                                       |
| Methods   | `POST` (JSON-RPC), `GET` (SSE stream), `DELETE` (session teardown)            |

The server ships with the app: it's a plain Next route handler
(`app/api/mcp/route.ts`) built on [`mcp-handler`](https://github.com/vercel/mcp-handler)
over the MCP TypeScript SDK, so it deploys to Vercel with everything else and
needs no second service.

## Client setup

Generate a token, put it in the environment (`MCP_AUTH_TOKEN` — see
`.env.example`), redeploy, then point a client at the endpoint.

**Claude Code** — one command:

```bash
claude mcp add --transport http keystroke-hub https://<your-deployment>/api/mcp \
  --header "Authorization: Bearer $MCP_AUTH_TOKEN"
```

**Claude Desktop / anything reading a JSON config** — one block:

```json
{
  "mcpServers": {
    "keystroke-hub": {
      "type": "http",
      "url": "https://<your-deployment>/api/mcp",
      "headers": {
        "Authorization": "Bearer PASTE_YOUR_MCP_AUTH_TOKEN"
      }
    }
  }
}
```

Sanity-check it from a shell:

```bash
curl -s https://<your-deployment>/api/mcp \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Without the header the same call answers `401` with
`{"error":"unauthorized", …}` and a `WWW-Authenticate: Bearer` challenge.

## Conventions

- **Ids, not names.** Ideas and streams reference a game by its library id
  (`list_games`), never by its name. Tags are free-form strings — call
  `list_tags` first so you reuse an existing hashtag instead of inventing a
  near-duplicate.
- **Times are the owner's wall clock.** Every timestamp comes back as
  `{ at, date, time }`: `at` is the absolute instant, `date`/`time` are the app
  timezone's wall clock (`NEXT_PUBLIC_APP_TIMEZONE`, default `Europe/Madrid`).
  Write tools take the `date`/`time` form. Never re-parse `at` as a wall clock
  (see [`docs/timezone.md`](timezone.md) and issue #95).
- **Updates replace, they don't patch.** `update_idea` and `update_stream`
  rewrite every field, so read the row first and send back what you want to
  keep. Narrow mutations exist where the UI has one (`set_idea_status`,
  `schedule_idea_release`, `reschedule_content_event`).
- **Errors are structured.** A failed call returns a tool result flagged
  `isError` whose text is
  `{"error":"invalid_request","message":"…","fieldErrors":{"tags":["…"]}}` —
  which field, what rule. A stack trace or a raw database error never crosses
  the wire; unexpected failures are logged server-side and reported as a
  generic message.
- **Deletes are permanent.** There is no archive and no undo. Every `delete_*`
  tool says so in its description, and `delete_game` makes you pass
  `confirm: true` after showing what's about to be untagged.

## Tools

### Ideas

| Tool                    | Parameters                                                                                        | Behaviour                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_ideas`            | `q?`, `format?`, `status?`, `tag?`, `game?`                                                       | Ideas newest first, with game, release slot and `hasScript`. The same filters the ideas page has; they combine (AND).                                                           |
| `get_idea`              | `ideaId`                                                                                          | One idea in full: fields, game, release, the whole Markdown script, the publish checklist, and every linked event (the managed release event is flagged `isRelease`).           |
| `create_idea`           | `title`, `description?`, `format?`, `tags?`, `gameId?`, `script?`, `releaseDate?`, `releaseTime?` | Captures an idea; only the title is required. A `releaseDate` creates the calendar event immediately; an omitted `releaseTime` lands at **19:00**. Returns `ideaId`.            |
| `update_idea`           | `ideaId`, `title`, `description?`, `format?`, `tags?`, `gameId?`, `releaseDate?`, `releaseTime?`  | Full replace. Omitting `releaseDate` **unschedules** the release and deletes its event.                                                                                         |
| `set_idea_status`       | `ideaId`, `status`                                                                                | Moves the idea through `idea → scripted → recorded → edited → published`. Entering a late stage seeds the publish checklist once; publishing reports `uncheckedChecklistItems`. |
| `schedule_idea_release` | `ideaId`, `releaseDate`, `releaseTime?`                                                           | Sets the release if there is none, moves it if there is. Nothing else is touched. Defaults to 19:00.                                                                            |
| `clear_idea_release`    | `ideaId`                                                                                          | Unschedules the release and deletes its event. Idempotent.                                                                                                                      |
| `delete_idea`           | `ideaId`                                                                                          | Deletes the idea, its script, checklist, links and release event.                                                                                                               |
| `list_tags`             | —                                                                                                 | Every distinct tag in use, alphabetically.                                                                                                                                      |

### Scripts

| Tool          | Parameters          | Behaviour                                                                                  |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------ |
| `get_script`  | `ideaId`            | The idea's Markdown script, or `content: null` if none was ever saved.                     |
| `save_script` | `ideaId`, `content` | Replaces the whole script (upsert). Capped at 200,000 characters, same as the script page. |

### Publish checklist

| Tool                         | Parameters                 | Behaviour                                |
| ---------------------------- | -------------------------- | ---------------------------------------- |
| `set_idea_checklist_item`    | `ideaId`, `itemId`, `done` | Ticks/unticks an item. Idempotent.       |
| `add_idea_checklist_item`    | `ideaId`, `label`          | Appends an item to one idea's checklist. |
| `remove_idea_checklist_item` | `ideaId`, `itemId`         | Deletes one item.                        |

### Streams

| Tool                             | Parameters                                                | Behaviour                                                                                                                                                                                       |
| -------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_streams`                   | —                                                         | The planner's three buckets: `upcoming`, `unscheduled`, `past`, each with checklist progress and the scheduled slot.                                                                            |
| `get_stream`                     | `streamId`                                                | One stream: game, notes, retro notes, full checklist, scheduled slot.                                                                                                                           |
| `create_stream`                  | `title`, `notes?`, `gameId?`, `date?`, `time?`, `allDay?` | Creates a session, snapshotting the current checklist template. With a `date` it's scheduled in the same call (timed slots run 2 h); without one it lands in `unscheduled`. Returns `streamId`. |
| `update_stream`                  | `streamId`, `title`, `notes?`, `retroNotes?`, `gameId?`   | Full replace of the editable fields. The schedule is untouched.                                                                                                                                 |
| `delete_stream`                  | `streamId`                                                | Deletes the stream, its checklist **and** the event scheduling it.                                                                                                                              |
| `schedule_stream`                | `streamId`, `eventId?` \| `date?` + `time?`/`allDay?`     | Either attaches an existing content event or creates one and attaches it. Work-track events are refused, as is an event another stream already claims.                                          |
| `unschedule_stream`              | `streamId`                                                | Detaches the event; the event itself survives as a plain content block.                                                                                                                         |
| `search_attachable_events`       | `query?`                                                  | Content events not already claimed by a stream, capped at 20.                                                                                                                                   |
| `set_checklist_item`             | `streamId`, `itemId`, `done`                              | Ticks/unticks a per-stream item. Idempotent.                                                                                                                                                    |
| `add_checklist_item`             | `streamId`, `label`                                       | Appends an item to one stream's checklist. Never touches the template.                                                                                                                          |
| `remove_checklist_item`          | `streamId`, `itemId`                                      | Deletes one item from one stream.                                                                                                                                                               |
| `get_checklist_template`         | —                                                         | The default checklist new streams are seeded from.                                                                                                                                              |
| `add_checklist_template_item`    | `label`                                                   | Appends to the template. Copy-on-create: existing streams keep what they were created with.                                                                                                     |
| `remove_checklist_template_item` | `itemId`                                                  | Removes from the template. Existing streams keep it.                                                                                                                                            |

### Games

| Tool          | Parameters           | Behaviour                                                                                                                                                          |
| ------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `list_games`  | —                    | The library alphabetically, with per-game idea and stream counts.                                                                                                  |
| `create_game` | `name`               | Adds the game, or returns the existing entry. Matching ignores case and collapses whitespace, exactly like the picker — no accidental second copy.                 |
| `rename_game` | `gameId`, `name`     | Renames; every idea and stream follows (they point at the id). Renaming onto another entry's name is refused rather than merging.                                  |
| `delete_game` | `gameId`, `confirm?` | Without `confirm` it previews the usage and deletes nothing. With `confirm: true` it deletes and **untags** the ideas/streams — never orphans, never deletes them. |

### Idea ↔ event links

| Tool                     | Parameters          | Behaviour                                                  |
| ------------------------ | ------------------- | ---------------------------------------------------------- |
| `link_idea_to_event`     | `ideaId`, `eventId` | Attaches an idea to a **content-track** event. Idempotent. |
| `unlink_idea_from_event` | `ideaId`, `eventId` | Removes the link; neither row is deleted.                  |
| `search_linkable_ideas`  | `eventId`, `query?` | Ideas not already linked to that event, capped at 20.      |

### Calendar (content track only)

| Tool                       | Parameters                                                                            | Behaviour                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_content_events`      | `from`, `to`                                                                          | Content events overlapping the (inclusive) day range, chronological. `kind` is `stream` when a session schedules the block. Work-track events are never returned. |
| `create_content_event`     | `title`, `description?`, `startDate`, `startTime?`, `endDate?`, `endTime?`, `allDay?` | Creates a plain content block. It cannot create a work event, and it cannot create a Stream block — use `create_stream`/`schedule_stream`.                        |
| `reschedule_content_event` | `eventId`, `startDate`, `startTime?`, `endDate?`, `endTime?`, `allDay?`               | Moves the slot only. Refuses work-track events.                                                                                                                   |
| `delete_content_event`     | `eventId`                                                                             | Deletes the event (and in Google Calendar). A stream scheduled by it survives as unscheduled. Refuses work-track events.                                          |

## How it stays honest

An MCP write is not a second implementation of the app — it's the **same** one.

- **One domain layer.** The server actions were split into a session gate plus
  a plain domain function (`lib/content/core/*.ts`, `lib/calendar/core.ts`).
  The UI calls the action; MCP calls the core directly. Same zod schemas, same
  19:00 release default, same tag normalisation, same duplicate-game rule.
- **Google sync parity.** Every event write schedules the same push-after-commit
  (`lib/sync/push.ts` via `after()`), so an MCP-created release or stream block
  reaches Google Calendar exactly as a UI-created one does
  (see [`docs/google-sync.md`](google-sync.md)).
- **Freshness.** The cores call `revalidatePath` — which works in route handlers
  — so the UI reflects an MCP write on the next visit, with no redeploy or
  restart.
- **Invariants hold from both sides.** A purple Stream block always has a real
  session behind it, because `create_content_event` deliberately cannot create
  one. A work-track event can never be read, moved or deleted, because the
  calendar tools re-read the event and refuse it before mutating, and the
  content-track checks in `linkIdeaToEventCore`/`attachEventToStreamCore` (and
  the composite FKs behind them) refuse it again.

## Auth

The token is a single static secret in `MCP_AUTH_TOKEN`, checked in
`lib/mcp/auth.ts` **before** the MCP handler runs, comparing SHA-256 digests
with `timingSafeEqual` so neither the value nor its length leaks through
timing. The route is exempt from the session proxy (`proxy.ts`'s matcher) the
same way the Google and cron routes are, each carrying its own auth; the human
cookie flow is untouched.

Unset or empty, the endpoint **fails closed** — a deployment that forgot to
configure the token exposes nothing rather than everything.

- **Rotate**: change `MCP_AUTH_TOKEN` on Vercel and redeploy. Every client needs
  the new value.
- **Scope**: the token is all-or-nothing. Anyone holding it can do everything
  the content workspace can do, including deletes. There is no per-tool scoping
  and no OAuth — proportionate for a single-user app; OAuth for MCP would be its
  own issue.
- **Rate limiting**: none, matching the login gate. Add Vercel WAF rules in
  front if the URL ever attracts attention.

## Testing

- **Unit** — `lib/mcp/auth.test.ts` (token accepted/rejected/missing/unset,
  constant-time compare), `lib/mcp/tool.test.ts` (result shapes, and that a
  thrown error becomes a structured error rather than a stack trace),
  `lib/mcp/server.test.ts` (unique names, no work-world tool, deletes warn),
  and one suite per tool module covering happy paths, validation failures and
  the invariants — duplicate game, stream/session integrity, work-track denial.
- **Route** — `app/api/mcp/route.test.ts` drives the real handler in-process:
  401 without a token, `initialize`, `tools/list`, and a structured error for a
  bad call.
- **E2E** — `e2e/mcp.spec.ts` speaks JSON-RPC to the running server over HTTP:
  rejection without a token, then two authorised round-trips (capture an idea →
  save its script → schedule its release, visible on the calendar; create a
  stream → schedule it → tick its checklist), plus a work-track denial against
  a real work event.

## Open questions

1. **Token rotation** is a redeploy. Fine for one user; a rotation window would
   need two accepted tokens.
2. **No pagination.** Every list is capped by the data volume of a single-user
   app (`list_ideas` returns everything). If the idea list ever grows past a
   comfortable context window, that's the first thing to add.
3. **No resources or prompts** — tools only. Exposing the calendar as an MCP
   resource would be a natural follow-up.
