// @vitest-environment node
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import proxy from "./proxy";
import { SESSION_COOKIE, encryptSession } from "@/lib/auth/session";

const TEST_SECRET = "p".repeat(32);

function request(
  path: string,
  sessionToken?: string,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: {
      ...(sessionToken ? { cookie: `${SESSION_COOKIE}=${sessionToken}` } : {}),
      ...headers,
    },
  });
}

async function validToken(): Promise<string> {
  return encryptSession(new Date(Date.now() + 60_000));
}

/** A still-valid session issued in the past — due for a rolling refresh. */
async function agedToken(): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("owner")
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 30 * 24 * 60 * 60)
    .sign(new TextEncoder().encode(TEST_SECRET));
}

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", TEST_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy auth gate", () => {
  it("redirects an unauthenticated page request to /login with `from`", async () => {
    const response = await proxy(request("/journal?week=27"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?from=%2Fjournal%3Fweek%3D27"
    );
  });

  it("redirects the unauthenticated root to /login without `from`", async () => {
    const response = await proxy(request("/"));
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login"
    );
  });

  it("answers unauthenticated API requests with 401 instead of a redirect", async () => {
    const response = await proxy(request("/api/anything"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("treats an expired session as unauthenticated", async () => {
    const expired = await encryptSession(new Date(Date.now() - 60_000));
    const response = await proxy(request("/journal", expired));
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?from=%2Fjournal"
    );
  });

  it("treats a tampered session as unauthenticated", async () => {
    const response = await proxy(request("/journal", "garbage.token.here"));
    expect(response.status).toBe(307);
  });

  it("lets a freshly issued session through without re-issuing it", async () => {
    const response = await proxy(request("/journal", await validToken()));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    // No churn: re-issuing on every request would let an in-flight response
    // resurrect the cookie right after sign-out.
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("re-issues a session that is due for its rolling refresh", async () => {
    const response = await proxy(request("/journal", await agedToken()));
    expect(response.status).toBe(200);

    const refreshed = response.cookies.get(SESSION_COOKIE);
    expect(refreshed?.value).toBeTruthy();
    expect(refreshed?.httpOnly).toBe(true);
    expect(refreshed?.sameSite).toBe("lax");
  });

  it("never re-issues a session on a prefetch request", async () => {
    const response = await proxy(
      request("/journal", await agedToken(), { "next-router-prefetch": "1" })
    );
    expect(response.status).toBe(200);
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("lets an unauthenticated request reach /login", async () => {
    const response = await proxy(request("/login"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("bounces an already-authenticated visit to /login back home", async () => {
    const response = await proxy(request("/login", await validToken()));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });
});
