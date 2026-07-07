import type { NextRequest } from "next/server";

import {
  exchangeCodeForTokens,
  getAppBaseUrl,
  verifyOAuthState,
} from "@/lib/google/oauth";
import { createGoogleCalendarClient } from "@/lib/google/client";
import { stashPendingConnection } from "@/lib/sync/actions";

/**
 * Google redirects here after the owner consents (or declines). Not gated
 * by the session proxy — Google hits it directly with no cookie — so it
 * carries its own auth via the signed `state` param (see proxy.ts's matcher
 * and lib/google/oauth.ts). On success, stashes the exchanged tokens in an
 * encrypted cookie and sends the owner to pick a calendar (docs/google-sync.md).
 */
export async function GET(request: NextRequest) {
  const settingsUrl = new URL("/settings/calendars", getAppBaseUrl());

  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (error || !code || !state) {
    settingsUrl.searchParams.set("error", "google_auth_failed");
    return Response.redirect(settingsUrl);
  }

  const track = await verifyOAuthState(state);
  if (!track) {
    settingsUrl.searchParams.set("error", "invalid_state");
    return Response.redirect(settingsUrl);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refreshToken) {
      settingsUrl.searchParams.set("error", "no_refresh_token");
      return Response.redirect(settingsUrl);
    }

    const client = createGoogleCalendarClient();
    const calendars = await client.listCalendars(tokens.accessToken);
    const primary =
      calendars.find((calendar) => calendar.primary) ?? calendars[0];

    await stashPendingConnection(
      track,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt,
      primary?.id ?? "unknown"
    );

    settingsUrl.searchParams.set("connect", "pending");
    return Response.redirect(settingsUrl);
  } catch {
    settingsUrl.searchParams.set("error", "google_auth_failed");
    return Response.redirect(settingsUrl);
  }
}
