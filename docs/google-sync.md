# Google Calendar sync

Issue #12 connects exactly two Google Calendars to the app — one to the
**work** track, one to **content** — and syncs events both ways, so the app
never becomes a second source of truth that drifts from the real calendars.

## Setup

Four env vars (`.env.example` has placeholder names only — this repo is
public):

| Env var                       | What it's for                                                         |
| ----------------------------- | --------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`            | OAuth client id from the Google Cloud Console.                        |
| `GOOGLE_CLIENT_SECRET`        | OAuth client secret.                                                  |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | AES-256-GCM key (base64 of 32 random bytes) encrypting stored tokens. |
| `CRON_SECRET`                 | Bearer token Vercel Cron sends to `/api/cron/calendar-sync`.          |

Generate the encryption key the same way as `SESSION_SECRET`:

```bash
openssl rand -base64 32
```

**Google Cloud Console, one-time, owner action (not automatable):**

1. Create an OAuth 2.0 client (type "Web application"), with an authorized
   redirect URI of `<your deployment URL>/api/google/oauth/callback`.
2. Add scopes `https://www.googleapis.com/auth/calendar.events` and
   `https://www.googleapis.com/auth/calendar.readonly` to the consent screen.
3. **Publish the app** (even just to "Testing" isn't enough long-term — a
   client left in _Testing_ mode has refresh tokens that silently expire
   after 7 days, which quietly kills sync). Publishing with only the two
   scopes above avoids Google's heaviest verification tier.

Locally, `APP_BASE_URL` (optional) overrides the base URL used to build the
OAuth redirect and webhook address; unset, it falls back to `VERCEL_URL` on
Vercel or `http://localhost:3000` otherwise.

## How it works

**Two independent OAuth connections, one per track.** Work and content
calendars may live on different Google accounts, so each track gets its own
authorization-code flow. The `calendar_connections` table (`lib/db/schema.ts`)
carries a unique constraint on `track` — at most one connection per track,
and every synced event inherits its track from its connection. Crossing
tracks is impossible by construction, the same way the `events` table's
`track` enum already enforces separation at the DB level.

**Connect flow**: Settings → Calendars → _Connect_ redirects to Google's
consent screen (`lib/google/oauth.ts#buildAuthUrl`, state signed with
`SESSION_SECRET`). The callback (`app/api/google/oauth/callback/route.ts`)
exchanges the code, lists the account's calendars, and stashes the tokens in
a short-lived encrypted cookie (`lib/google/oauth.ts#signPendingConnection`)
while the owner picks which calendar to sync — the "work calendar" isn't
always `primary`. Picking one (`finishConnect` in `lib/sync/actions.ts`)
creates the `calendar_connections` row and runs the first sync.

**Inbound sync (Google → app)**: `lib/sync/run.ts#runInboundSync` lists
events incrementally via a stored `syncToken`, falling back to a full re-list
(3 months back, 12 months forward) on Google's `410 GONE` or on the very
first sync. Recurring events arrive pre-expanded into individually
addressable instances (`singleEvents=true`), so no separate recurrence logic
is needed — each instance is a normal event as far as the sync engine is
concerned. Every decision (create/update/delete locally, skip an echo, or
flag a conflict) is made by the pure, directly-unit-tested core in
`lib/sync/engine.ts`; `run.ts` just executes those decisions against the
database.

**Outbound sync (app → Google)**: `createEvent`/`updateEvent`/`deleteEvent`
(`lib/calendar/actions.ts`) schedule a push via Next's `after()` — it never
delays or can fail the user-facing mutation. A push failure leaves the sync
link `pending_push`/`pending_delete` for the cron to retry
(`lib/sync/run.ts#retryPendingPushes`); the local write already succeeded
either way.

**Echo suppression & conflicts.** Every outbound write records the resulting
Google `etag`/`updated` on the event's `event_sync_links` row. An inbound
delta whose `etag` matches what we just wrote is recognized as our own echo
and skipped. A true conflict — both sides changed independently since the
link was last touched — resolves by **latest edit wins**, comparing Google's
`updated` against the local `updatedAt`; the losing side's key fields are
overwritten, and a human-readable `conflictNote` is stored on the link and
surfaced as a badge + dismissible note on the event (predictable and visible,
per the issue's acceptance criteria).

**Disconnect / reconnect.** Disconnecting revokes the Google tokens and stops
the push channel (both best-effort — disconnect always succeeds locally even
if Google is unreachable), then _orphans_ the connection's sync links
(clears `connectionId`, keeps `googleEventId`) rather than deleting them —
app events are completely untouched. Reconnecting to the same track looks up
orphaned links for that track by remembered `googleEventId` before falling
back to creating new events, so a disconnect/reconnect cycle re-links
losslessly instead of duplicating everything.

**Push channels & the cron.** `events.watch` channels expire and can't reach
`localhost`, so `app/api/cron/calendar-sync/route.ts` (guarded by a
`CRON_SECRET` bearer token) is the reconciliation safety net: it re-runs
inbound sync for every connection, retries pending outbound pushes, and
renews channels nearing expiry. In local dev this cron route (and the
"Sync now" button) are the _only_ sync mechanisms — webhooks never fire.
`vercel.json` schedules it daily (`0 3 * * *`) — the once-a-day ceiling on
Vercel's Hobby plan; a Pro plan can run it more often for fresher
reconciliation.

## Data model

- **`calendar_connections`** — one row per connected track: Google account
  email, calendar id, encrypted access/refresh tokens + expiry, sync token,
  watch-channel bookkeeping, `status` (`active`/`error`/`disconnected`),
  `lastSyncedAt`/`lastError`.
- **`event_sync_links`** — one row per synced event: `eventId` (nullable,
  `ON DELETE SET NULL` — see below), `connectionId` (nullable, same reason),
  `googleEventId` (nullable until the first successful push), `googleEtag`/
  `googleUpdatedAt` (the echo-suppression stamp), `pushState`
  (`synced`/`pending_push`/`pending_delete`/`error`), `conflictNote`.

Deleting a local event needs the Google-side delete to survive past the
event row's own lifetime, so `lib/calendar/actions.ts#deleteEvent` captures
the link _before_ deleting the event (its `eventId` auto-nulls via
`ON DELETE SET NULL` the instant the event is gone) and pushes the delete
from that captured reference in `after()`.

## Testing

Real Google OAuth isn't automatable in CI, so both layers fake the Google
side rather than hitting it:

- **Unit tests** fake `GoogleCalendarClient` directly with plain objects
  (`lib/google/client.ts`'s interface is designed for this) — see
  `lib/sync/engine.test.ts` (the pure decision core), `lib/sync/run.test.ts`,
  `lib/sync/push.test.ts`, and the route handler auth tests under
  `app/api/google/*` and `app/api/cron/*`.
- **E2e tests** (`e2e/calendar-sync.spec.ts`) point the app's outbound calls
  at a local fake server (`e2e/support/fake-google-server.ts`, run as a
  second Playwright `webServer`) via `GOOGLE_CALENDAR_API_BASE_URL` /
  `GOOGLE_OAUTH_TOKEN_BASE_URL` env overrides — Playwright's page-level route
  interception can't reach these calls since they happen server-side. The
  real OAuth consent redirect itself is never exercised; specs seed a
  `calendar_connections` row directly instead (`e2e/support/calendar-connections-db.ts`).

**Manual verification** before merging a change here: one real end-to-end
pass against a real Google account on a Vercel preview (the fake server
proves the app's own logic; it can't prove Google's actual API behavior
matches the fakes).

## Known follow-ups

- **Google OAuth consent screen must be published** by the owner in Google
  Cloud Console before refresh tokens survive past 7 days — see Setup above.
- **Real client credentials** (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/
  `GOOGLE_TOKEN_ENCRYPTION_KEY`) need to be set in Vercel and local `.env`.
- **`vercel.json` cron schedule** for `/api/cron/calendar-sync` needs
  `CRON_SECRET` configured in the Vercel project.
- **One real end-to-end verification pass** against real Google account(s)
  on a Vercel preview hasn't been done yet (not possible from this
  environment — see Testing above).
- Recurring event **editing** writes a single-instance Google exception
  (patching that instance's own id); in-app recurrence _authoring_ is out of
  scope for v1.
