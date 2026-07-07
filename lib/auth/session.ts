import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const SESSION_COOKIE = "session";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, rolling
/** The proxy re-issues a session at most this often (see proxy.ts). */
export const SESSION_REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

// The app has exactly one user; the subject claim just marks the token as ours.
const SESSION_SUBJECT = "owner";

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters. " +
        "Generate one with `openssl rand -base64 32` — see docs/auth.md."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function encryptSession(expiresAt: Date): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(SESSION_SUBJECT)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecretKey());
}

/** Returns the token payload, or `null` for missing/tampered/expired tokens. */
export async function decryptSession(
  token: string | undefined
): Promise<JWTPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
      subject: SESSION_SUBJECT,
    });
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    // Safari refuses Secure cookies on plain-http localhost, so dev stays
    // non-secure; `next start` (e2e) and Vercel both run in production mode.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  } as const;
}

export async function createSession(): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await encryptSession(expiresAt);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Data-access-layer check — the authoritative gate (the proxy check is only
 * optimistic). Call from every protected layout/page/route handler/action.
 * Redirects to /login when the session is missing or invalid.
 */
export const verifySession = cache(async (): Promise<{ isAuth: true }> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await decryptSession(token);

  if (!session) {
    redirect("/login");
  }

  return { isAuth: true };
});
