"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import type { Track } from "@/lib/calendar/types";
import { getDb } from "@/lib/db";
import { calendarConnections, eventSyncLinks } from "@/lib/db/schema";
import { createGoogleCalendarClient } from "@/lib/google/client";
import { encryptToken, decryptToken } from "@/lib/google/crypto";
import {
  PENDING_CONNECTION_COOKIE,
  buildAuthUrl,
  revokeToken,
  signPendingConnection,
  verifyPendingConnection,
} from "@/lib/google/oauth";

import {
  getValidAccessToken,
  retryPendingPushes,
  runInboundSync,
  setupWatchChannel,
} from "./run";

const TRACK_LABEL: Record<Track, string> = { work: "Work", content: "Content" };

const PENDING_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 10 * 60,
} as const;

export interface CalendarActionState {
  error?: string;
}

/** Kicks off the Google consent redirect for a track. Never returns — always redirects. */
export async function startConnect(track: Track): Promise<never> {
  await verifySession();
  const url = await buildAuthUrl(track);
  redirect(url);
}

/**
 * Called from the OAuth callback route handler (not a form action) once the
 * code has been exchanged — stashes the tokens in an encrypted cookie until
 * the owner picks which calendar to sync (open question 5).
 */
export async function stashPendingConnection(
  track: Track,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date,
  googleAccountEmail: string
): Promise<void> {
  const token = await signPendingConnection({
    track,
    accessToken,
    refreshToken,
    expiresAt: expiresAt.getTime(),
    googleAccountEmail,
  });
  (await cookies()).set(
    PENDING_CONNECTION_COOKIE,
    token,
    PENDING_COOKIE_OPTIONS
  );
}

/** Finishes the connect flow once the owner has picked a calendar from the pending connection's account. */
export async function finishConnect(
  calendarId: string
): Promise<CalendarActionState> {
  await verifySession();

  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_CONNECTION_COOKIE)?.value;
  const pending = token ? await verifyPendingConnection(token) : null;
  if (!pending) {
    return { error: "Your Google connection expired — try connecting again." };
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.track, pending.track));
  if (existing) {
    return {
      error: `${TRACK_LABEL[pending.track]} already has a connected calendar — disconnect it first.`,
    };
  }

  const [connection] = await db
    .insert(calendarConnections)
    .values({
      track: pending.track,
      googleAccountEmail: pending.googleAccountEmail,
      googleCalendarId: calendarId,
      accessTokenEncrypted: encryptToken(pending.accessToken),
      refreshTokenEncrypted: encryptToken(pending.refreshToken),
      tokenExpiresAt: new Date(pending.expiresAt),
    })
    .returning();

  cookieStore.delete(PENDING_CONNECTION_COOKIE);

  const client = createGoogleCalendarClient();
  try {
    await runInboundSync(connection.id, client);
  } catch {
    // Connection row exists and is marked `status: "error"` by runInboundSync
    // itself — surfaced in the settings UI; "Sync now" lets the owner retry.
  }
  await setupWatchChannel(connection.id);

  revalidatePath("/settings/calendars");
  revalidatePath("/calendar");
  return {};
}

/**
 * Disconnects a track's calendar: revokes Google tokens and stops the watch
 * channel (both best-effort — a disconnect must always succeed locally even
 * if Google is unreachable), then orphans this connection's sync links
 * (keeps the Google event id, clears the connection) rather than deleting
 * them, so a future reconnect can re-link losslessly (open question 4). App
 * events themselves are never touched.
 */
export async function disconnectCalendar(
  track: Track
): Promise<CalendarActionState> {
  await verifySession();

  const db = getDb();
  const [connection] = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.track, track));
  if (!connection) return {};

  const client = createGoogleCalendarClient();
  try {
    const accessToken = await getValidAccessToken(connection);
    if (connection.channelId && connection.channelResourceId) {
      await client.stopChannel(
        accessToken,
        connection.channelId,
        connection.channelResourceId
      );
    }
    await revokeToken(decryptToken(connection.refreshTokenEncrypted));
  } catch {
    // Best-effort — proceed to remove local connection state regardless.
  }

  await db
    .update(eventSyncLinks)
    .set({ connectionId: null })
    .where(eq(eventSyncLinks.connectionId, connection.id));
  await db
    .delete(calendarConnections)
    .where(eq(calendarConnections.id, connection.id));

  revalidatePath("/settings/calendars");
  revalidatePath("/calendar");
  return {};
}

/** Manual "Sync now" — runs inbound sync and retries any outbound pushes still pending. */
export async function syncNow(track: Track): Promise<CalendarActionState> {
  await verifySession();

  const db = getDb();
  const [connection] = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.track, track));
  if (!connection) return { error: "Not connected." };

  const client = createGoogleCalendarClient();
  try {
    await runInboundSync(connection.id, client);
    await retryPendingPushes(connection.id, client);
  } catch {
    return {
      error: "Sync failed — check the connection status and try again.",
    };
  }

  revalidatePath("/settings/calendars");
  revalidatePath("/calendar");
  return {};
}

export interface CalendarPickerCalendar {
  id: string;
  summary: string;
  primary?: boolean;
}

export interface PendingConnectionView {
  track: Track;
  googleAccountEmail: string;
  calendars: CalendarPickerCalendar[];
}

/** Reads the pending-connection cookie (if any) and re-lists the account's calendars for the picker UI. */
export async function getPendingConnectionView(): Promise<PendingConnectionView | null> {
  const token = (await cookies()).get(PENDING_CONNECTION_COOKIE)?.value;
  const pending = token ? await verifyPendingConnection(token) : null;
  if (!pending) return null;

  const client = createGoogleCalendarClient();
  try {
    const calendars = await client.listCalendars(pending.accessToken);
    return {
      track: pending.track,
      googleAccountEmail: pending.googleAccountEmail,
      calendars,
    };
  } catch {
    return null;
  }
}

/** Dismisses the conflict-resolution note on an event's sync link (see the event editor's conflict banner). */
export async function dismissConflictNote(eventId: string): Promise<void> {
  await verifySession();
  const db = getDb();
  await db
    .update(eventSyncLinks)
    .set({ conflictNote: null })
    .where(eq(eventSyncLinks.eventId, eventId));
  revalidatePath("/calendar");
}
