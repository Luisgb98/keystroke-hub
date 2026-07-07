import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { eventSyncLinks, events } from "@/lib/db/schema";
import type { Track } from "@/lib/calendar/types";
import { createGoogleCalendarClient } from "@/lib/google/client";

import { toGooglePayload } from "./engine";
import { getConnectionForTrack, getValidAccessToken } from "./run";

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
  const connection = await getConnectionForTrack(track);
  if (!connection) return;

  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) return;

  const [link] = await db
    .select()
    .from(eventSyncLinks)
    .where(eq(eventSyncLinks.eventId, eventId));

  // Not yet linked to this connection (e.g. the connection was created
  // after this event) — an update becomes the event's first push.
  if (!link) {
    await pushEventCreated(eventId, track);
    return;
  }

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
