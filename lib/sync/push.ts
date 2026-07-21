import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  eventSyncLinks,
  events,
  type CalendarConnection,
} from "@/lib/db/schema";
import type { Track } from "@/lib/calendar/types";
import {
  createGoogleCalendarClient,
  type GoogleCalendarClient,
} from "@/lib/google/client";

import { toGooglePayload } from "./engine";
import {
  getConnectionById,
  getConnectionForTrack,
  getValidAccessToken,
} from "./run";

/**
 * Outbound push hook for the event mutation Server Actions
 * (`lib/calendar/actions.ts`), run via Next's `after()` so it never delays
 * the user-facing response. Failure never blocks or reverts the local
 * write — the link is left `pending_push`/`pending_delete` for the cron to
 * retry (see docs/google-sync.md).
 */

export async function pushEventCreated(
  eventId: string,
  track: Track
): Promise<void> {
  const connection = await getConnectionForTrack(track);
  if (!connection) return;

  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) return; // deleted concurrently before the push ran

  const client = createGoogleCalendarClient();
  try {
    const accessToken = await getValidAccessToken(connection);
    const pushed = await client.insertEvent(
      accessToken,
      connection.googleCalendarId,
      toGooglePayload(event)
    );
    await db.insert(eventSyncLinks).values({
      eventId,
      connectionId: connection.id,
      googleEventId: pushed.id,
      googleEtag: pushed.etag,
      googleUpdatedAt: new Date(pushed.updated),
      pushState: "synced",
    });
  } catch {
    await db.insert(eventSyncLinks).values({
      eventId,
      connectionId: connection.id,
      googleEventId: null,
      pushState: "pending_push",
    });
  }
}

export async function pushEventUpdated(
  eventId: string,
  track: Track
): Promise<void> {
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) return;

  const [link] = await db
    .select()
    .from(eventSyncLinks)
    .where(eq(eventSyncLinks.eventId, eventId));

  // Not yet linked (e.g. the connection was created after this event) — an
  // update becomes the event's first push, onto the current track's calendar.
  if (!link) {
    await pushEventCreated(eventId, track);
    return;
  }

  // The link's own connection is where the event's Google copy actually lives.
  // If that calendar belongs to a *different* track than the event now has,
  // the track was flipped: the event must leave the old calendar and be
  // re-created on the new track's calendar — never pushed onto it with the old
  // calendar's event id (issue #67, finding A2). This holds even when the link
  // has no Google id yet (a never-pushed pending link): otherwise it would
  // fall through and insert the flipped event onto the *old* track's calendar.
  const linkConnection = link.connectionId
    ? await getConnectionById(link.connectionId)
    : null;
  if (linkConnection && linkConnection.track !== track) {
    await pushEventTrackFlipped(
      { id: link.id, googleEventId: link.googleEventId },
      linkConnection,
      event,
      track
    );
    return;
  }

  // Otherwise the event is still on its own calendar, or the link was orphaned
  // by a disconnect (connectionId nulled). For an orphaned link we push onto
  // the current track's connection.
  const orphaned = !link.connectionId;
  const connection = linkConnection ?? (await getConnectionForTrack(track));
  if (!connection) return;

  const client = createGoogleCalendarClient();
  try {
    const accessToken = await getValidAccessToken(connection);
    // Insert fresh — rather than patch — when the link has no Google id yet,
    // or when it's orphaned. A reconnect can point the track at a *different*
    // Google calendar, where the old event id is invalid and a patch would
    // 404 forever; inbound skip-echo already re-adopts same-calendar
    // reconnects before any edit, so an orphaned link reaching here needs a
    // fresh push, not a patch (issue #67, finding A2 follow-up).
    if (!link.googleEventId || orphaned) {
      const pushed = await client.insertEvent(
        accessToken,
        connection.googleCalendarId,
        toGooglePayload(event)
      );
      await db
        .update(eventSyncLinks)
        .set({
          connectionId: connection.id,
          googleEventId: pushed.id,
          googleEtag: pushed.etag,
          googleUpdatedAt: new Date(pushed.updated),
          pushState: "synced",
        })
        .where(eq(eventSyncLinks.id, link.id));
      return;
    }

    const pushed = await client.patchEvent(
      accessToken,
      connection.googleCalendarId,
      link.googleEventId,
      toGooglePayload(event)
    );
    await db
      .update(eventSyncLinks)
      .set({
        connectionId: connection.id,
        googleEtag: pushed.etag,
        googleUpdatedAt: new Date(pushed.updated),
        pushState: "synced",
      })
      .where(eq(eventSyncLinks.id, link.id));
  } catch {
    // Re-point `connectionId` too: an orphaned link (nulled by a disconnect)
    // whose push failed would otherwise stay `connectionId`-null and never be
    // picked up by the retry cron (which filters by connection), stranding the
    // edit (issue #67, finding A2 follow-up).
    await db
      .update(eventSyncLinks)
      .set({ connectionId: connection.id, pushState: "pending_push" })
      .where(eq(eventSyncLinks.id, link.id));
  }
}

/**
 * Best-effort removal of an event's copy from its old-track calendar during a
 * track flip. Returns `true` when the copy is gone (deleted, or never existed
 * because the link had no Google id yet), `false` when a live copy could not
 * be deleted — the caller keeps a tombstone so the delete is retried.
 */
async function removeOldCalendarCopy(
  client: GoogleCalendarClient,
  connection: CalendarConnection,
  googleEventId: string | null
): Promise<boolean> {
  if (!googleEventId) return true;
  try {
    const accessToken = await getValidAccessToken(connection);
    await client.deleteEvent(
      accessToken,
      connection.googleCalendarId,
      googleEventId
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Moves a synced event off its old track's calendar after a track flip: remove
 * the old-calendar copy, then re-create it on the new track's calendar via
 * `pushEventCreated`. The old Google event id is only valid on the old
 * calendar, so it is never pushed onto the new one (issue #67, finding A2).
 *
 * If the old-calendar delete fails, the link is kept as a `pending_delete`
 * tombstone decoupled from the event (`eventId` nulled) — so the cron finishes
 * deleting the old copy (otherwise a later full re-list would re-import it as a
 * cross-track ghost) while freeing the event's unique link slot for the fresh
 * link `pushEventCreated` makes on the new calendar.
 */
async function pushEventTrackFlipped(
  link: { id: string; googleEventId: string | null },
  oldConnection: CalendarConnection,
  event: typeof events.$inferSelect,
  newTrack: Track
): Promise<void> {
  const db = getDb();
  const client = createGoogleCalendarClient();

  const oldCopyRemoved = await removeOldCalendarCopy(
    client,
    oldConnection,
    link.googleEventId
  );

  if (oldCopyRemoved) {
    // Old copy gone (or never existed) — drop the stale link entirely.
    await db.delete(eventSyncLinks).where(eq(eventSyncLinks.id, link.id));
  } else {
    // Old copy still live and its delete failed — keep this link as a
    // decoupled pending_delete tombstone so the cron finishes removing it.
    await db
      .update(eventSyncLinks)
      .set({
        eventId: null,
        connectionId: oldConnection.id,
        pushState: "pending_delete",
      })
      .where(eq(eventSyncLinks.id, link.id));
  }

  // Re-create the event on the new track's calendar — a no-op if that track
  // has no connection, in which case the event is simply unsynced now.
  await pushEventCreated(event.id, newTrack);
}

/**
 * `linkId`/`googleEventId` must be captured by the caller *before* deleting
 * the event — the link's `eventId` auto-nulls via `ON DELETE SET NULL` the
 * moment the event row is gone (see lib/db/schema.ts), and this runs in
 * `after()`, strictly after that delete has already happened.
 */
export async function pushEventDeleted(
  linkId: string,
  googleEventId: string | null,
  track: Track
): Promise<void> {
  const connection = await getConnectionForTrack(track);
  if (!connection) return;

  const db = getDb();

  if (!googleEventId) {
    // Never made it to Google in the first place — nothing to delete there.
    await db.delete(eventSyncLinks).where(eq(eventSyncLinks.id, linkId));
    return;
  }

  const client = createGoogleCalendarClient();
  try {
    const accessToken = await getValidAccessToken(connection);
    await client.deleteEvent(
      accessToken,
      connection.googleCalendarId,
      googleEventId
    );
    await db.delete(eventSyncLinks).where(eq(eventSyncLinks.id, linkId));
  } catch {
    await db
      .update(eventSyncLinks)
      .set({ pushState: "pending_delete" })
      .where(eq(eventSyncLinks.id, linkId));
  }
}
