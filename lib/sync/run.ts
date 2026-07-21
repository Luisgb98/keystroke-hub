import "server-only";

import { randomUUID } from "node:crypto";

import { addMonths, subMonths } from "date-fns";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  calendarConnections,
  eventSyncLinks,
  events,
  type CalendarConnection,
} from "@/lib/db/schema";
import { decryptToken, encryptToken } from "@/lib/google/crypto";
import {
  generateChannelToken,
  getAppBaseUrl,
  refreshAccessToken,
} from "@/lib/google/oauth";
import {
  SyncTokenExpiredError,
  createGoogleCalendarClient,
  type GoogleCalendarClient,
  type GoogleEventsPage,
} from "@/lib/google/client";

import { planInboundActions, toGooglePayload } from "./engine";
import type { LocalEventSnapshot, SyncLinkRecord } from "./types";

/** Bounded initial-sync window (open question 3 in the issue #12 plan): 3 months back, 12 months forward. */
export const SYNC_WINDOW_MONTHS_BACK = 3;
export const SYNC_WINDOW_MONTHS_FORWARD = 12;

/** Refresh proactively once within this many ms of expiry, to avoid a request racing an actual 401. */
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;

/** Renew a watch channel once it's within this long of expiring (cron runs daily — see vercel.json). */
const CHANNEL_RENEWAL_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Public because `lib/sync/push.ts` and `lib/sync/actions.ts` need a valid access token for the same connection row too. */
export async function getValidAccessToken(
  connection: CalendarConnection
): Promise<string> {
  const expiresAt = connection.tokenExpiresAt.getTime();
  if (expiresAt - Date.now() > TOKEN_REFRESH_SKEW_MS) {
    return decryptToken(connection.accessTokenEncrypted);
  }

  const refreshToken = decryptToken(connection.refreshTokenEncrypted);
  const refreshed = await refreshAccessToken(refreshToken);

  const db = getDb();
  await db
    .update(calendarConnections)
    .set({
      accessTokenEncrypted: encryptToken(refreshed.accessToken),
      tokenExpiresAt: refreshed.expiresAt,
    })
    .where(eq(calendarConnections.id, connection.id));

  return refreshed.accessToken;
}

/** Callers pass rows that are already known to have a `googleEventId` (see the two `for` loops in `runInboundSync`). */
function toSyncLinkRecord(
  row: typeof eventSyncLinks.$inferSelect & { googleEventId: string }
): SyncLinkRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    googleEventId: row.googleEventId,
    googleEtag: row.googleEtag,
    updatedAt: row.updatedAt,
    pushState: row.pushState,
  };
}

/** The active connection for a track, if any — used by the outbound push hook and Server Actions. */
export async function getConnectionForTrack(
  track: CalendarConnection["track"]
): Promise<CalendarConnection | null> {
  const db = getDb();
  const [connection] = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.track, track));
  return connection ?? null;
}

function toLocalEventSnapshot(
  row: typeof events.$inferSelect
): LocalEventSnapshot {
  return {
    id: row.id,
    track: row.track,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
    updatedAt: row.updatedAt,
  };
}

/** Pages through `events.list` (incremental or full), returning every item and the final page's `nextSyncToken`. */
async function collectAllPages(
  fetchPage: (pageToken?: string) => Promise<GoogleEventsPage>
): Promise<{ items: GoogleEventsPage["items"]; nextSyncToken?: string }> {
  const items: GoogleEventsPage["items"] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  do {
    const page = await fetchPage(pageToken);
    items.push(...page.items);
    pageToken = page.nextPageToken;
    if (page.nextSyncToken) nextSyncToken = page.nextSyncToken;
  } while (pageToken);

  return { items, nextSyncToken };
}

/**
 * Runs one inbound sync pass for a connection: incremental (via the stored
 * `syncToken`) when one exists, falling back to a full re-list on Google's
 * `410 GONE`; a bounded full list for a first-ever (initial) sync. Applies
 * every resulting action to the database, then persists the new sync token
 * and status. See docs/google-sync.md for the overall design.
 */
export async function runInboundSync(
  connectionId: string,
  client: GoogleCalendarClient
): Promise<void> {
  const db = getDb();
  const [connection] = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.id, connectionId));
  if (!connection)
    throw new Error(`Unknown calendar connection: ${connectionId}`);

  try {
    const accessToken = await getValidAccessToken(connection);

    const fetchIncremental = (pageToken?: string) =>
      client.listEvents(accessToken, connection.googleCalendarId, {
        syncToken: connection.syncToken ?? undefined,
        pageToken,
      });
    const fetchFull = (pageToken?: string) =>
      client.listEvents(accessToken, connection.googleCalendarId, {
        timeMin: subMonths(new Date(), SYNC_WINDOW_MONTHS_BACK).toISOString(),
        timeMax: addMonths(
          new Date(),
          SYNC_WINDOW_MONTHS_FORWARD
        ).toISOString(),
        pageToken,
      });

    let result: { items: GoogleEventsPage["items"]; nextSyncToken?: string };
    if (connection.syncToken) {
      try {
        result = await collectAllPages(fetchIncremental);
      } catch (error) {
        if (!(error instanceof SyncTokenExpiredError)) throw error;
        result = await collectAllPages(fetchFull);
      }
    } else {
      result = await collectAllPages(fetchFull);
    }

    // Links for this connection, plus orphaned links (from a previous
    // disconnect on this track) so a reconnect re-links losslessly by
    // remembered Google event id — see docs/google-sync.md open question 4.
    const ownLinks = await db
      .select()
      .from(eventSyncLinks)
      .where(eq(eventSyncLinks.connectionId, connection.id));
    const orphanedLinks = await db
      .select({ link: eventSyncLinks, event: events })
      .from(eventSyncLinks)
      .innerJoin(events, eq(eventSyncLinks.eventId, events.id))
      .where(
        and(
          isNull(eventSyncLinks.connectionId),
          eq(events.track, connection.track)
        )
      );

    const linksByGoogleId = new Map<string, SyncLinkRecord>();
    for (const row of ownLinks) {
      // Links awaiting their very first push (see lib/sync/push.ts) have no
      // Google id yet — nothing for the inbound planner to match them against.
      if (row.googleEventId)
        linksByGoogleId.set(
          row.googleEventId,
          toSyncLinkRecord({ ...row, googleEventId: row.googleEventId })
        );
    }
    for (const { link } of orphanedLinks) {
      if (link.googleEventId && !linksByGoogleId.has(link.googleEventId)) {
        linksByGoogleId.set(
          link.googleEventId,
          toSyncLinkRecord({ ...link, googleEventId: link.googleEventId })
        );
      }
    }

    const referencedEventIds = [...linksByGoogleId.values()]
      .map((link) => link.eventId)
      .filter((id): id is string => id !== null);
    const localEventRows = referencedEventIds.length
      ? await db
          .select()
          .from(events)
          .where(inArray(events.id, referencedEventIds))
      : [];
    const localEventsById = new Map(
      localEventRows.map((row) => [row.id, toLocalEventSnapshot(row)])
    );

    const actions = planInboundActions({
      remoteEvents: result.items,
      linksByGoogleId,
      localEventsById,
    });

    for (const action of actions) {
      switch (action.type) {
        case "create-local": {
          const [inserted] = await db
            .insert(events)
            .values({ track: connection.track, ...action.input })
            .returning({ id: events.id });
          await db.insert(eventSyncLinks).values({
            eventId: inserted.id,
            connectionId: connection.id,
            googleEventId: action.remote.googleEventId,
            googleEtag: action.remote.googleEtag,
            googleUpdatedAt: action.remote.googleUpdatedAt,
            pushState: "synced",
          });
          break;
        }
        case "update-local": {
          await db
            .update(events)
            .set(action.input)
            .where(eq(events.id, action.eventId));
          await db
            .update(eventSyncLinks)
            .set({
              connectionId: connection.id,
              googleEtag: action.remote.googleEtag,
              googleUpdatedAt: action.remote.googleUpdatedAt,
              pushState: "synced",
            })
            .where(
              eq(eventSyncLinks.googleEventId, action.remote.googleEventId)
            );
          break;
        }
        case "delete-local": {
          await db
            .delete(eventSyncLinks)
            .where(eq(eventSyncLinks.eventId, action.eventId));
          await db.delete(events).where(eq(events.id, action.eventId));
          break;
        }
        case "conflict-remote-wins": {
          await db
            .update(events)
            .set(action.input)
            .where(eq(events.id, action.eventId));
          await db
            .update(eventSyncLinks)
            .set({
              connectionId: connection.id,
              googleEtag: action.remote.googleEtag,
              googleUpdatedAt: action.remote.googleUpdatedAt,
              pushState: "synced",
              conflictNote: action.note,
            })
            .where(
              eq(eventSyncLinks.googleEventId, action.remote.googleEventId)
            );
          break;
        }
        case "conflict-local-wins": {
          const local = [...localEventsById.values()].find(
            (event) => event.id === action.eventId
          );
          if (local) {
            const pushed = await client.patchEvent(
              accessToken,
              connection.googleCalendarId,
              action.googleEventId,
              toGooglePayload(local)
            );
            await db
              .update(eventSyncLinks)
              .set({
                connectionId: connection.id,
                googleEtag: pushed.etag,
                googleUpdatedAt: new Date(pushed.updated),
                pushState: "synced",
                conflictNote: action.note,
              })
              .where(eq(eventSyncLinks.googleEventId, action.googleEventId));
          }
          break;
        }
        case "skip-echo":
          // Re-adopt an orphaned link (its `connectionId` nulled by a past
          // disconnect on this track) when its unchanged remote echoes back
          // after a reconnect. Without this the retry cron — which filters by
          // `connectionId` — would never retry the link's pending push, and
          // its outbound edit would be stranded forever (issue #67, finding
          // A4). Guarded to `connectionId IS NULL` so a normal echo doesn't
          // needlessly bump the link's `updatedAt` (the conflict boundary).
          await db
            .update(eventSyncLinks)
            .set({ connectionId: connection.id })
            .where(
              and(
                eq(eventSyncLinks.googleEventId, action.googleEventId),
                isNull(eventSyncLinks.connectionId)
              )
            );
          break;
      }
    }

    await db
      .update(calendarConnections)
      .set({
        syncToken: result.nextSyncToken ?? connection.syncToken,
        status: "active",
        lastSyncedAt: new Date(),
        lastError: null,
      })
      .where(eq(calendarConnections.id, connection.id));
  } catch (error) {
    await db
      .update(calendarConnections)
      .set({
        status: "error",
        lastError: error instanceof Error ? error.message : String(error),
      })
      .where(eq(calendarConnections.id, connection.id));
    throw error;
  }
}

/**
 * Retries every `pending_push`/`pending_delete` sync link for a connection —
 * the cron's safety net for outbound pushes that failed synchronously (see
 * the `after()` hook in `lib/calendar/actions.ts`).
 */
export async function retryPendingPushes(
  connectionId: string,
  client: GoogleCalendarClient
): Promise<void> {
  const db = getDb();
  const [connection] = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.id, connectionId));
  if (!connection) return;

  const accessToken = await getValidAccessToken(connection);

  const pending = await db
    .select({ link: eventSyncLinks, event: events })
    .from(eventSyncLinks)
    .leftJoin(events, eq(eventSyncLinks.eventId, events.id))
    .where(
      and(
        eq(eventSyncLinks.connectionId, connection.id),
        inArray(eventSyncLinks.pushState, ["pending_push", "pending_delete"])
      )
    );

  for (const { link, event } of pending) {
    try {
      if (link.pushState === "pending_delete") {
        if (link.googleEventId) {
          await client.deleteEvent(
            accessToken,
            connection.googleCalendarId,
            link.googleEventId
          );
        }
        await db.delete(eventSyncLinks).where(eq(eventSyncLinks.id, link.id));
      } else if (event && link.googleEventId) {
        const pushed = await client.patchEvent(
          accessToken,
          connection.googleCalendarId,
          link.googleEventId,
          toGooglePayload(event)
        );
        await db
          .update(eventSyncLinks)
          .set({
            googleEtag: pushed.etag,
            googleUpdatedAt: new Date(pushed.updated),
            pushState: "synced",
          })
          .where(eq(eventSyncLinks.id, link.id));
      } else if (event) {
        // Never successfully pushed at all — no Google id to patch against yet.
        const pushed = await client.insertEvent(
          accessToken,
          connection.googleCalendarId,
          toGooglePayload(event)
        );
        await db
          .update(eventSyncLinks)
          .set({
            googleEventId: pushed.id,
            googleEtag: pushed.etag,
            googleUpdatedAt: new Date(pushed.updated),
            pushState: "synced",
          })
          .where(eq(eventSyncLinks.id, link.id));
      }
    } catch {
      // Leave pending_push/pending_delete — the next cron run retries again.
    }
  }
}

/**
 * Creates a fresh `events.watch` push channel for a connection. Best-effort
 * and a no-op on `localhost` — webhooks need a public HTTPS address, so
 * local dev relies entirely on manual "Sync now" and cron reconciliation
 * (open question 6). Failures here never block connect/sync from succeeding.
 */
export async function setupWatchChannel(connectionId: string): Promise<void> {
  const baseUrl = getAppBaseUrl();
  if (baseUrl.startsWith("http://localhost")) return;

  const db = getDb();
  const [connection] = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.id, connectionId));
  if (!connection) return;

  const client = createGoogleCalendarClient();
  try {
    const accessToken = await getValidAccessToken(connection);
    const channelId = randomUUID();
    const channelToken = generateChannelToken();
    const expirationMs = Date.now() + 7 * 24 * 60 * 60 * 1000; // Google's practical max for calendar watch

    const result = await client.watchEvents(
      accessToken,
      connection.googleCalendarId,
      {
        id: channelId,
        address: `${baseUrl}/api/google/webhook`,
        token: channelToken,
        expirationMs,
      }
    );

    await db
      .update(calendarConnections)
      .set({
        channelId,
        channelResourceId: result.resourceId,
        channelExpiresAt: new Date(Number(result.expiration)),
        channelToken,
      })
      .where(eq(calendarConnections.id, connectionId));
  } catch {
    // Sync still works via manual "Sync now" and cron reconciliation.
  }
}

/** Stops and replaces a connection's watch channel once it's close to expiring — called by the cron route. */
export async function renewWatchChannelIfNeeded(
  connection: CalendarConnection,
  client: GoogleCalendarClient
): Promise<void> {
  const expiresAt = connection.channelExpiresAt?.getTime();
  const needsRenewal =
    !expiresAt || expiresAt - Date.now() < CHANNEL_RENEWAL_WINDOW_MS;
  if (!needsRenewal) return;

  if (connection.channelId && connection.channelResourceId) {
    try {
      const accessToken = await getValidAccessToken(connection);
      await client.stopChannel(
        accessToken,
        connection.channelId,
        connection.channelResourceId
      );
    } catch {
      // Old channel will simply expire on its own.
    }
  }

  await setupWatchChannel(connection.id);
}
