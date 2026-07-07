// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import {
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  createSession,
  decryptSession,
  deleteSession,
  encryptSession,
  sessionCookieOptions,
  verifySession,
} from "./session";

const TEST_SECRET = "a".repeat(32);
const future = () => new Date(Date.now() + 60_000);

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", TEST_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("encryptSession / decryptSession", () => {
  it("roundtrips: an issued token decrypts to the owner session", async () => {
    const token = await encryptSession(future());
    const payload = await decryptSession(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("owner");
  });

  it("rejects a tampered token", async () => {
    const token = await encryptSession(future());
    const [header, body, signature] = token.split(".");
    const tampered = `${header}.${body}${body.endsWith("A") ? "B" : "A"}.${signature}`;
    await expect(decryptSession(tampered)).resolves.toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await encryptSession(future());
    vi.stubEnv("SESSION_SECRET", "b".repeat(32));
    await expect(decryptSession(token)).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await encryptSession(new Date(Date.now() - 60_000));
    await expect(decryptSession(token)).resolves.toBeNull();
  });

  it("returns null for a missing token", async () => {
    await expect(decryptSession(undefined)).resolves.toBeNull();
    await expect(decryptSession("")).resolves.toBeNull();
  });

  it("throws a clear error when SESSION_SECRET is missing", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    await expect(encryptSession(future())).rejects.toThrow(/SESSION_SECRET/);
  });

  it("throws a clear error when SESSION_SECRET is too short", async () => {
    vi.stubEnv("SESSION_SECRET", "short");
    await expect(encryptSession(future())).rejects.toThrow(/32 characters/);
  });
});

describe("createSession / deleteSession", () => {
  it("sets an HttpOnly lax session cookie expiring ~30 days out", async () => {
    await createSession();

    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    const [name, token, options] = cookieStore.set.mock.calls[0];
    expect(name).toBe(SESSION_COOKIE);
    await expect(decryptSession(token)).resolves.not.toBeNull();
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    const drift = Math.abs(
      options.expires.getTime() - (Date.now() + SESSION_DURATION_MS)
    );
    expect(drift).toBeLessThan(5_000);
  });

  it("deleteSession removes the cookie", async () => {
    await deleteSession();
    expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_COOKIE);
  });
});

describe("sessionCookieOptions", () => {
  it("is Secure only in production (Safari rejects Secure on http://localhost)", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieOptions(future()).secure).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    expect(sessionCookieOptions(future()).secure).toBe(false);
  });
});

describe("verifySession (DAL)", () => {
  it("redirects to /login when there is no session cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(verifySession()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /login when the cookie is garbage", async () => {
    cookieStore.get.mockReturnValue({ value: "not-a-jwt" });
    await expect(verifySession()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("returns the auth marker for a valid session", async () => {
    cookieStore.get.mockReturnValue({ value: await encryptSession(future()) });
    await expect(verifySession()).resolves.toEqual({ isAuth: true });
  });
});
