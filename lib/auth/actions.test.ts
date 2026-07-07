// @vitest-environment node
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("@/lib/auth/session", () => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import { createSession, deleteSession } from "@/lib/auth/session";
import { hashPassword } from "./password";
import { login, logout } from "./actions";

const PASSWORD = "hunter2hunter2";
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

beforeEach(() => {
  vi.stubEnv("AUTH_PASSWORD_HASH", passwordHash);
  vi.stubEnv("AUTH_FAILURE_DELAY_MS", "0");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("login", () => {
  it("rejects an empty password without touching the session", async () => {
    await expect(login(undefined, form({ password: "" }))).resolves.toEqual({
      error: "Enter your password.",
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("rejects a missing password field", async () => {
    await expect(login(undefined, form({}))).resolves.toEqual({
      error: "Enter your password.",
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("returns a generic error for a wrong password", async () => {
    const state = await login(undefined, form({ password: "wrong" }));
    expect(state).toEqual({ error: "That password isn't right." });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("creates a session and redirects home on the correct password", async () => {
    await expect(
      login(undefined, form({ password: PASSWORD }))
    ).rejects.toThrow("NEXT_REDIRECT:/");
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it("redirects back to the deep-linked path via `from`", async () => {
    await expect(
      login(undefined, form({ password: PASSWORD, from: "/journal?week=27" }))
    ).rejects.toThrow("NEXT_REDIRECT:/journal?week=27");
  });

  it.each(["https://evil.example", "//evil.example", "javascript:alert(1)"])(
    "never redirects outside the app (%s)",
    async (from) => {
      await expect(
        login(undefined, form({ password: PASSWORD, from }))
      ).rejects.toThrow("NEXT_REDIRECT:/");
    }
  );

  it("throws a clear setup error when AUTH_PASSWORD_HASH is unset", async () => {
    vi.stubEnv("AUTH_PASSWORD_HASH", "");
    await expect(
      login(undefined, form({ password: PASSWORD }))
    ).rejects.toThrow(/AUTH_PASSWORD_HASH/);
  });

  it("waits out the failure delay on a wrong password", async () => {
    vi.stubEnv("AUTH_FAILURE_DELAY_MS", "120");
    const started = Date.now();
    await login(undefined, form({ password: "wrong" }));
    expect(Date.now() - started).toBeGreaterThanOrEqual(100);
  });
});

describe("logout", () => {
  it("deletes the session and redirects to /login", async () => {
    await expect(logout()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(deleteSession).toHaveBeenCalledTimes(1);
  });
});
