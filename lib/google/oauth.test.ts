// @vitest-environment node
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildAuthUrl,
  generateChannelToken,
  getAppBaseUrl,
  getOAuthRedirectUri,
  signOAuthState,
  signPendingConnection,
  verifyOAuthState,
  verifyPendingConnection,
} from "./oauth";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.SESSION_SECRET = "a".repeat(32);
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  delete process.env.VERCEL_URL;
  delete process.env.APP_BASE_URL;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("getAppBaseUrl", () => {
  it("defaults to localhost:3000", () => {
    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });

  it("prefers APP_BASE_URL when set", () => {
    process.env.APP_BASE_URL = "https://example.com";
    expect(getAppBaseUrl()).toBe("https://example.com");
  });

  it("prefers VERCEL_URL over APP_BASE_URL", () => {
    process.env.APP_BASE_URL = "https://example.com";
    process.env.VERCEL_URL = "my-app-git-branch.vercel.app";
    expect(getAppBaseUrl()).toBe("https://my-app-git-branch.vercel.app");
  });
});

describe("getOAuthRedirectUri", () => {
  it("appends the callback path to the app base url", () => {
    expect(getOAuthRedirectUri()).toBe(
      "http://localhost:3000/api/google/oauth/callback"
    );
  });
});

describe("OAuth state", () => {
  it("round-trips the track through sign/verify", async () => {
    const state = await signOAuthState("work");
    await expect(verifyOAuthState(state)).resolves.toBe("work");
  });

  it("round-trips the content track too", async () => {
    const state = await signOAuthState("content");
    await expect(verifyOAuthState(state)).resolves.toBe("content");
  });

  it("rejects a tampered state token", async () => {
    const state = await signOAuthState("work");
    await expect(verifyOAuthState(`${state}tampered`)).resolves.toBeNull();
  });

  it("rejects garbage input", async () => {
    await expect(verifyOAuthState("not-a-jwt")).resolves.toBeNull();
  });

  it("rejects a state signed with a different secret", async () => {
    const state = await signOAuthState("work");
    process.env.SESSION_SECRET = "b".repeat(32);
    await expect(verifyOAuthState(state)).resolves.toBeNull();
  });
});

describe("buildAuthUrl", () => {
  it("includes the client id, calendar scopes, offline access, and a state param", async () => {
    const url = new URL(await buildAuthUrl("work"));
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("scope")).toContain(
      "https://www.googleapis.com/auth/calendar.events"
    );
    expect(url.searchParams.get("scope")).toContain(
      "https://www.googleapis.com/auth/calendar.readonly"
    );
    const state = url.searchParams.get("state");
    expect(state).toBeTruthy();
    await expect(verifyOAuthState(state!)).resolves.toBe("work");
  });
});

describe("pending connection", () => {
  const pending = {
    track: "content" as const,
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: Date.now() + 3600_000,
    googleAccountEmail: "owner@example.com",
  };

  it("round-trips through sign/verify", async () => {
    const token = await signPendingConnection(pending);
    await expect(verifyPendingConnection(token)).resolves.toEqual(pending);
  });

  it("rejects a tampered token", async () => {
    const token = await signPendingConnection(pending);
    // A compact JWE is 5 base64url segments joined by ".". Tampering the
    // *final* character(s) of the token (the tail of the auth tag segment)
    // is unreliable: when a segment's byte length isn't a multiple of 3,
    // its last base64url character only carries a couple of significant
    // bits — the rest is padding a permissive decoder ignores — so two
    // different characters there can decode to the identical byte and the
    // "tampered" token silently verifies as valid. Flipping a character in
    // the *middle* of the ciphertext segment instead is guaranteed to alter
    // a real ciphertext byte, which GCM's auth tag will always reject.
    const parts = token.split(".");
    const ciphertext = parts[3];
    const index = Math.floor(ciphertext.length / 2);
    const original = ciphertext[index];
    const flipped = original === "A" ? "B" : "A";
    parts[3] =
      ciphertext.slice(0, index) + flipped + ciphertext.slice(index + 1);
    await expect(verifyPendingConnection(parts.join("."))).resolves.toBeNull();
  });

  it("rejects garbage input", async () => {
    await expect(verifyPendingConnection("not-a-jwe")).resolves.toBeNull();
  });
});

describe("generateChannelToken", () => {
  it("generates unique tokens", () => {
    expect(generateChannelToken()).not.toBe(generateChannelToken());
  });
});
