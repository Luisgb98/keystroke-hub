import { randomBytes } from "node:crypto";
import { EncryptJWT, SignJWT, jwtDecrypt, jwtVerify } from "jose";

import type { Track } from "@/lib/calendar/types";

// OAuth 2.0 authorization-code flow against Google's endpoints, hand-rolled
// with `fetch` (see docs/google-sync.md) rather than a client library — the
// surface used is small and this keeps the injectable-fake story trivial for
// tests. Scopes cover both syncing events and listing calendars during setup.
//
// `GOOGLE_OAUTH_TOKEN_BASE_URL` overrides the token/revoke base (consent
// itself is a real browser redirect and is never faked or exercised in
// e2e — see e2e/support/fake-google-server.ts).
const OAUTH_TOKEN_BASE =
  process.env.GOOGLE_OAUTH_TOKEN_BASE_URL ?? "https://oauth2.googleapis.com";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = `${OAUTH_TOKEN_BASE}/token`;
const REVOKE_ENDPOINT = `${OAUTH_TOKEN_BASE}/revoke`;
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

const STATE_ISSUER = "keystroke-hub:google-oauth-state";
const STATE_TTL_SECONDS = 10 * 60; // the whole consent redirect round-trip

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters — reused to " +
        "sign the OAuth state token (see docs/google-sync.md)."
    );
  }
  return new TextEncoder().encode(secret);
}

function getClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set — see docs/google-sync.md."
    );
  }
  return { clientId, clientSecret };
}

/** `https://<vercel-deployment>` in prod/preview, else `APP_BASE_URL` (for local/self-hosted), else localhost. */
export function getAppBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

export function getOAuthRedirectUri(): string {
  return `${getAppBaseUrl()}/api/google/oauth/callback`;
}

/** Signs a short-lived state token carrying the track being connected — verified in the callback. */
export async function signOAuthState(track: Track): Promise<string> {
  return new SignJWT({ track })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(STATE_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

/** Verifies and decodes the OAuth `state` param. Returns `null` for missing/tampered/expired/invalid state. */
export async function verifyOAuthState(state: string): Promise<Track | null> {
  try {
    const { payload } = await jwtVerify(state, getSecretKey(), {
      algorithms: ["HS256"],
      issuer: STATE_ISSUER,
    });
    const track = payload.track;
    return track === "work" || track === "content" ? track : null;
  } catch {
    return null;
  }
}

/** The URL to redirect the owner to for Google's consent screen. */
export async function buildAuthUrl(track: Track): Promise<string> {
  const { clientId } = getClientCredentials();
  const state = await signOAuthState(track);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getOAuthRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    // Forces Google to re-issue a refresh token even on a reconnect to an
    // account that already granted consent once (Google otherwise omits it).
    prompt: "consent",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export async function exchangeCodeForTokens(
  code: string
): Promise<OAuthTokens> {
  const { clientId, clientSecret } = getClientCredentials();

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getOAuthRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status}`);
  }

  const data = (await response.json()) as TokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/** Exchanges a stored refresh token for a fresh access token. Google doesn't rotate the refresh token on this call. */
export async function refreshAccessToken(
  refreshToken: string
): Promise<Pick<OAuthTokens, "accessToken" | "expiresAt">> {
  const { clientId, clientSecret } = getClientCredentials();

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as TokenResponse;
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/** Revokes a token (access or refresh) at disconnect time. Best-effort — Google returns 200 even for already-invalid tokens. */
export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
}

/** A per-channel secret Google echoes back as `X-Goog-Channel-Token` on every webhook push for that channel. */
export function generateChannelToken(): string {
  return randomBytes(32).toString("base64url");
}

// --- Pending connection (between the OAuth callback and the calendar-pick step) ---
//
// The callback exchanges the code for tokens and lists the account's
// calendars, but the owner still has to pick one (open question 5 in the
// issue #12 plan) before a `calendar_connections` row is created. The
// tokens have to live somewhere for that one extra round-trip; a JWE
// (encrypted, not just signed — this payload holds a real refresh token)
// in a short-lived httpOnly cookie avoids adding any server-side storage
// for what's a few seconds of owner interaction.
export const PENDING_CONNECTION_COOKIE = "google_pending_connection";
const PENDING_TTL_SECONDS = 10 * 60;

export interface PendingConnection {
  track: Track;
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
  googleAccountEmail: string;
}

function getEncryptionKey(): Uint8Array {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "GOOGLE_TOKEN_ENCRYPTION_KEY is not set — see docs/google-sync.md."
    );
  }
  return new Uint8Array(Buffer.from(secret, "base64"));
}

export async function signPendingConnection(
  data: PendingConnection
): Promise<string> {
  return new EncryptJWT({ ...data })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_TTL_SECONDS}s`)
    .encrypt(getEncryptionKey());
}

export async function verifyPendingConnection(
  token: string
): Promise<PendingConnection | null> {
  try {
    const { payload } = await jwtDecrypt(token, getEncryptionKey());
    const { track, accessToken, refreshToken, expiresAt, googleAccountEmail } =
      payload as Partial<PendingConnection>;
    if (
      (track !== "work" && track !== "content") ||
      typeof accessToken !== "string" ||
      typeof refreshToken !== "string" ||
      typeof expiresAt !== "number" ||
      typeof googleAccountEmail !== "string"
    ) {
      return null;
    }
    return { track, accessToken, refreshToken, expiresAt, googleAccountEmail };
  } catch {
    return null;
  }
}
