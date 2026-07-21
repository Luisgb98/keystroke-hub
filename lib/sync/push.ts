import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  eventSyncLinks,
  events,
  type CalendarConnection,
} from "@/lib/db/schema";
import type { Track } from "@/lib/calendar/types";
import { createGoogleCalendarClient } from "@/lib/google/client";

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
  // re-created on the new track's calendar — never patched onto it with the
  // old calendar's event id (issue #67, finding A2).
  const linkConnection = link.connectionId
    ? await getConnectionById(link.connectionId)
    : null;
  if (link.googleEventId && linkConnection && linkConnection.track !== track) {
    await pushEventTrackFlipped(
      { id: link.id, googleEventId: link.googleEventId },
      linkConnection,
      event,
      track
    );
    return;
  }

  // Otherwise the event is still on its own calendar (or the link was orphaned
  // by a disconnect and we re-adopt it by patching against the current track's
  // reconnected calendar).
  const connection = linkConnection ?? (await getConnectionForTrack(track));
  if (!connection) return;

  const client = createGoogleCalendarClient();
  try {
    const accessToken = await getValidAccessToken(connection);
    if (!link.googleEventId) {
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
    await db
      .update(eventSyncLinks)
      .set({ pushState: "pending_push" })
      .where(eq(eventSyncLinks.id, link.id));
  }
}

/**
 * Moves a synced event from its old track's Google calendar to the new
 * track's calendar after a track flip: delete the old-calendar copy, then
 * re-create on the new calendar. The old Google event id is only valid on the
 * old calendar, so it must never be patched onto the new one — that would 404
 * and, via the retry cron, keep pushing one track's data at the other track's
 * calendar (issue #67, finding A2).
 */
async function pushEventTrackFlipped(
  link: { id: string; googleEventId: string },
  oldConnection: CalendarConnection,
  event: typeof events.$inferSelect,
  newTrack: Track
): Promise<void> {
  const db = getDb();
  const client = createGoogleCalendarClient();
  const newConnection = await getConnectionForTrack(newTrack);

  // Remove the copy from the old track's calendar first (best-effort — a stale
  // copy left behind is far better than writing this event onto the wrong
  // track's calendar).
  try {
    const oldToken = await getValidAccessToken(oldConnection);
    await client.deleteEvent(
      oldToken,
      oldConnection.googleCalendarId,
      link.googleEventId
    );
  } catch {
    // Leave the old copy; the important guarantee is that we stop pushing the
    // old id onto the new calendar below.
  }

  // New track isn't connected to any calendar — the event is simply unsynced
  // now, so drop the link rather than keep pushing a dead id.
  if (!newConnection) {
    await db.delete(eventSyncLinks).where(eq(eventSyncLinks.id, link.id));
    return;
  }

  try {
    const newToken = await getValidAccessToken(newConnection);
    const pushed = await client.insertEvent(
      newToken,
      newConnection.googleCalendarId,
      toGooglePayload(event)
    );
    await db
      .update(eventSyncLinks)
      .set({
        connectionId: newConnection.id,
        googleEventId: pushed.id,
        googleEtag: pushed.etag,
        googleUpdatedAt: new Date(pushed.updated),
        pushState: "synced",
        conflictNote: null,
      })
      .where(eq(eventSyncLinks.id, link.id));
  } catch {
    // Couldn't create on the new calendar yet — point the link at the new
    // connection with no Google id so the retry cron does a fresh insert
    // there, never a patch against the old calendar's id.
    await db
      .update(eventSyncLinks)
      .set({
        connectionId: newConnection.id,
        googleEventId: null,
        pushState: "pending_push",
      })
      .where(eq(eventSyncLinks.id, link.id));
  }
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
