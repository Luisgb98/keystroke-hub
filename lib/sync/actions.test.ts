// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ verifySession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const cookieStore = vi.hoisted(() => ({
  value: undefined as string | undefined,
  set: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => (cookieStore.value ? { value: cookieStore.value } : undefined),
    set: cookieStore.set,
    delete: cookieStore.delete,
  })),
}));

vi.mock("@/lib/google/client", () => ({
  createGoogleCalendarClient: vi.fn(),
}));
vi.mock("@/lib/google/crypto", () => ({
  encryptToken: (v: string) => `enc:${v}`,
  decryptToken: (v: string) => v.replace(/^enc:/, ""),
}));
vi.mock("@/lib/google/oauth", () => ({
  PENDING_CONNECTION_COOKIE: "google_pending_connection",
  buildAuthUrl: vi.fn(
    async (track: string) =>
      `https://accounts.google.com/consent?track=${track}`
  ),
  revokeToken: vi.fn(),
  signPendingConnection: vi.fn(async (data: unknown) => JSON.stringify(data)),
  verifyPendingConnection: vi.fn(async (token: string) => JSON.parse(token)),
}));
vi.mock("./run", () => ({
  getValidAccessToken: vi.fn(async () => "access-token"),
  retryPendingPushes: vi.fn(),
  runInboundSync: vi.fn(),
  setupWatchChannel: vi.fn(),
}));

const dbMock = vi.hoisted(() => {
  const state: {
    connections: unknown[];
    inserted: unknown;
    updatedLinks: unknown[];
    deletedTables: unknown[];
  } = {
    connections: [],
    inserted: undefined,
    updatedLinks: [],
    deletedTables: [],
  };

  return {
    state,
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(async () => state.connections) })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => ({
        returning: vi.fn(async () => {
          const row = { id: "conn-new", ...(values as object) };
          state.inserted = row;
          return [row];
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => ({
        where: vi.fn(async () => {
          state.updatedLinks.push(values);
        }),
      })),
    })),
    delete: vi.fn((table: unknown) => ({
      where: vi.fn(async () => {
        state.deletedTables.push(table);
      }),
    })),
  };
});
vi.mock("@/lib/db", () => ({ getDb: () => dbMock }));

import { verifySession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { calendarConnections } from "@/lib/db/schema";
import { createGoogleCalendarClient } from "@/lib/google/client";
import { revokeToken } from "@/lib/google/oauth";
import { retryPendingPushes, runInboundSync } from "./run";
import {
  disconnectCalendar,
  dismissConflictNote,
  finishConnect,
  startConnect,
  syncNow,
} from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifySession).mockResolvedValue({ isAuth: true });
  dbMock.state.connections = [];
  dbMock.state.inserted = undefined;
  dbMock.state.updatedLinks = [];
  dbMock.state.deletedTables = [];
  cookieStore.value = undefined;
});

describe("startConnect", () => {
  it("verifies the session and redirects to the Google consent URL", async () => {
    await expect(startConnect("work")).rejects.toThrow(
      "NEXT_REDIRECT:https://accounts.google.com/consent?track=work"
    );
    expect(verifySession).toHaveBeenCalledTimes(1);
  });
});

describe("disconnectCalendar", () => {
  it("orphans this connection's sync links and deletes the connection row, never touching events", async () => {
    dbMock.state.connections = [
      {
        id: "conn-1",
        track: "work",
        channelId: null,
        channelResourceId: null,
        refreshTokenEncrypted: "enc:refresh-token",
        accessTokenEncrypted: "enc:access-token",
        tokenExpiresAt: new Date(Date.now() + 3600_000),
      },
    ];

    const result = await disconnectCalendar("work");

    expect(result).toEqual({});
    expect(revokeToken).toHaveBeenCalledWith("refresh-token");
    // The link update orphans (nulls connectionId) rather than deleting rows.
    expect(dbMock.state.updatedLinks).toEqual([{ connectionId: null }]);
    expect(dbMock.state.deletedTables).toEqual([calendarConnections]);
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("is a no-op when the track has no connection", async () => {
    dbMock.state.connections = [];
    const result = await disconnectCalendar("content");
    expect(result).toEqual({});
    expect(dbMock.state.deletedTables).toEqual([]);
  });
});

describe("syncNow", () => {
  it("errors when the track has no connection", async () => {
    dbMock.state.connections = [];
    const result = await syncNow("work");
    expect(result).toEqual({ error: "Not connected." });
  });

  it("runs inbound sync and retries pending pushes on success", async () => {
    dbMock.state.connections = [{ id: "conn-1", track: "work" }];
    const client = {};
    vi.mocked(createGoogleCalendarClient).mockReturnValue(client as never);

    const result = await syncNow("work");

    expect(result).toEqual({});
    expect(runInboundSync).toHaveBeenCalledWith("conn-1", client);
    expect(retryPendingPushes).toHaveBeenCalledWith("conn-1", client);
  });

  it("returns an error (not a throw) when sync fails", async () => {
    dbMock.state.connections = [{ id: "conn-1", track: "work" }];
    vi.mocked(runInboundSync).mockRejectedValueOnce(new Error("boom"));

    const result = await syncNow("work");

    expect(result.error).toMatch(/sync failed/i);
  });
});

describe("finishConnect", () => {
  it("errors when the pending-connection cookie is missing or invalid", async () => {
    cookieStore.value = undefined;
    const result = await finishConnect("cal-1");
    expect(result.error).toMatch(/expired/i);
    expect(dbMock.state.inserted).toBeUndefined();
  });

  it("errors when the track already has a connection", async () => {
    cookieStore.value = JSON.stringify({
      track: "work",
      accessToken: "a",
      refreshToken: "r",
      expiresAt: Date.now() + 3600_000,
      googleAccountEmail: "owner@example.com",
    });
    dbMock.state.connections = [{ id: "existing", track: "work" }];

    const result = await finishConnect("cal-1");

    expect(result.error).toMatch(/already has a connected calendar/i);
    expect(dbMock.state.inserted).toBeUndefined();
  });

  it("creates the connection, clears the cookie, and syncs on success", async () => {
    cookieStore.value = JSON.stringify({
      track: "work",
      accessToken: "a",
      refreshToken: "r",
      expiresAt: Date.now() + 3600_000,
      googleAccountEmail: "owner@example.com",
    });
    dbMock.state.connections = [];

    const result = await finishConnect("cal-1");

    expect(result).toEqual({});
    expect(dbMock.state.inserted).toMatchObject({
      track: "work",
      googleCalendarId: "cal-1",
      googleAccountEmail: "owner@example.com",
      accessTokenEncrypted: "enc:a",
      refreshTokenEncrypted: "enc:r",
    });
    expect(cookieStore.delete).toHaveBeenCalledWith(
      "google_pending_connection"
    );
    expect(runInboundSync).toHaveBeenCalled();
  });
});

describe("dismissConflictNote", () => {
  it("clears the conflict note on the event's sync link", async () => {
    await dismissConflictNote("evt-1");
    expect(dbMock.state.updatedLinks).toEqual([{ conflictNote: null }]);
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });
});
