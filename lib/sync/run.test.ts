// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { calendarConnections, events, eventSyncLinks } from "@/lib/db/schema";
import { SyncTokenExpiredError } from "@/lib/google/client";

/**
 * A minimal fake of the subset of the Drizzle query builder `lib/sync/run.ts`
 * uses, keyed by table identity. Good enough to exercise the orchestration
 * logic (which query drives which write) without a real database — the
 * actual diff/merge decisions it's orchestrating are unit-tested directly in
 * lib/sync/engine.test.ts.
 */
function createFakeDb() {
  const queues = new Map<unknown, unknown[]>();
  const writes: { op: string; table: unknown; values?: unknown }[] = [];

  function queue(table: unknown, value: unknown) {
    const q = queues.get(table) ?? [];
    q.push(value);
    queues.set(table, q);
  }
  function nextFor(table: unknown) {
    const q = queues.get(table) ?? [];
    return q.length > 0 ? q.shift() : [];
  }

  function fromChain(table: unknown) {
    const resolved = () => Promise.resolve(nextFor(table));
    const chain = {
      where: vi.fn(() => resolved()),
      leftJoin: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      orderBy: vi.fn(() => resolved()),
    };
    return chain;
  }

  const db = {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => fromChain(table)),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        writes.push({ op: "insert", table, values });
        const generated = { id: "generated-id", ...(values as object) };
        return {
          returning: vi.fn(() => Promise.resolve([generated])),
          then: (resolve: (v: unknown) => void) => resolve(undefined),
        };
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: unknown) => ({
        where: vi.fn(() => {
          writes.push({ op: "update", table, values });
          return Promise.resolve(undefined);
        }),
      })),
    })),
    delete: vi.fn((table: unknown) => ({
      where: vi.fn(() => {
        writes.push({ op: "delete", table });
        return Promise.resolve(undefined);
      }),
    })),
  };

  return { db, queue, writes };
}

const fakeDb = vi.hoisted(() => ({
  current: null as null | ReturnType<typeof createFakeDb>,
}));

vi.mock("@/lib/db", () => ({
  getDb: () => fakeDb.current!.db,
}));
vi.mock("@/lib/google/oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/google/oauth")>();
  return { ...actual, refreshAccessToken: vi.fn() };
});
vi.mock("@/lib/google/crypto", () => ({
  encryptToken: (v: string) => `enc:${v}`,
  decryptToken: (v: string) => v.replace(/^enc:/, ""),
}));

import { refreshAccessToken } from "@/lib/google/oauth";
import type { GoogleCalendarClient } from "@/lib/google/client";
import { retryPendingPushes, runInboundSync, setupWatchChannel } from "./run";

function baseConnection(
  overrides: Partial<typeof calendarConnections.$inferSelect> = {}
) {
  return {
    id: "conn-1",
    track: "work" as const,
    googleAccountEmail: "owner@example.com",
    googleCalendarId: "cal-1",
    accessTokenEncrypted: "enc:access-token",
    refreshTokenEncrypted: "enc:refresh-token",
    tokenExpiresAt: new Date(Date.now() + 3600_000),
    syncToken: null,
    channelId: null,
    channelResourceId: null,
    channelExpiresAt: null,
    channelToken: null,
    status: "active" as const,
    lastSyncedAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeClient(
  overrides: Partial<GoogleCalendarClient> = {}
): GoogleCalendarClient {
  return {
    listCalendars: vi.fn().mockResolvedValue([]),
    listEvents: vi.fn().mockResolvedValue({ items: [] }),
    insertEvent: vi.fn(),
    patchEvent: vi.fn(),
    deleteEvent: vi.fn(),
    watchEvents: vi.fn(),
    stopChannel: vi.fn(),
    ...overrides,
  };
}

let fake: ReturnType<typeof createFakeDb>;

beforeEach(() => {
  fake = createFakeDb();
  fakeDb.current = fake;
  vi.clearAllMocks();
});

describe("runInboundSync", () => {
  it("creates a local event and its sync link from an unlinked remote event, then persists the new sync token", async () => {
    fake.queue(calendarConnections, [baseConnection()]);
    fake.queue(eventSyncLinks, []); // ownLinks
    fake.queue(eventSyncLinks, []); // orphanedLinks join
    fake.queue(events, []); // referenced local events (none)

    const client = fakeClient({
      listEvents: vi.fn().mockResolvedValue({
        items: [
          {
            id: "g-1",
            status: "confirmed",
            summary: "Standup",
            start: { dateTime: "2026-07-08T09:00:00Z" },
            end: { dateTime: "2026-07-08T09:15:00Z" },
            updated: "2026-07-08T08:00:00Z",
            etag: '"e1"',
          },
        ],
        nextSyncToken: "sync-token-2",
      }),
    });

    await runInboundSync("conn-1", client);

    const eventInsert = fake.writes.find(
      (w) => w.op === "insert" && w.table === events
    );
    expect(eventInsert?.values).toMatchObject({
      track: "work",
      title: "Standup",
    });

    const linkInsert = fake.writes.find(
      (w) => w.op === "insert" && w.table === eventSyncLinks
    );
    expect(linkInsert?.values).toMatchObject({
      googleEventId: "g-1",
      pushState: "synced",
    });

    const connectionUpdate = fake.writes.find(
      (w) => w.op === "update" && w.table === calendarConnections
    );
    expect(connectionUpdate?.values).toMatchObject({
      syncToken: "sync-token-2",
      status: "active",
    });
  });

  it("falls back to a full re-list on a 410 SyncTokenExpiredError", async () => {
    fake.queue(calendarConnections, [
      baseConnection({ syncToken: "stale-token" }),
    ]);
    fake.queue(eventSyncLinks, []);
    fake.queue(eventSyncLinks, []);
    fake.queue(events, []);

    const listEvents = vi
      .fn()
      .mockRejectedValueOnce(new SyncTokenExpiredError())
      .mockResolvedValueOnce({ items: [], nextSyncToken: "fresh-token" });
    const client = fakeClient({ listEvents });

    await runInboundSync("conn-1", client);

    expect(listEvents).toHaveBeenCalledTimes(2);
    const [, , firstCallParams] = listEvents.mock.calls[0];
    expect(firstCallParams).toMatchObject({ syncToken: "stale-token" });
    const [, , secondCallParams] = listEvents.mock.calls[1];
    expect(secondCallParams.syncToken).toBeUndefined();
    expect(secondCallParams.timeMin).toBeDefined();
  });

  it("marks the connection status as error (and rethrows) on a genuine failure", async () => {
    fake.queue(calendarConnections, [baseConnection()]);
    const client = fakeClient({
      listEvents: vi.fn().mockRejectedValue(new Error("network down")),
    });

    await expect(runInboundSync("conn-1", client)).rejects.toThrow(
      "network down"
    );

    const connectionUpdate = fake.writes.find(
      (w) => w.op === "update" && w.table === calendarConnections
    );
    expect(connectionUpdate?.values).toMatchObject({
      status: "error",
      lastError: "network down",
    });
  });

  it("refreshes the access token when it's near expiry", async () => {
    fake.queue(
      calendarConnections,
      [baseConnection({ tokenExpiresAt: new Date(Date.now() + 1000) })] // 1s left
    );
    fake.queue(eventSyncLinks, []);
    fake.queue(eventSyncLinks, []);
    fake.queue(events, []);
    vi.mocked(refreshAccessToken).mockResolvedValue({
      accessToken: "new-access-token",
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const client = fakeClient();
    await runInboundSync("conn-1", client);

    expect(refreshAccessToken).toHaveBeenCalledWith("refresh-token");
    const tokenUpdate = fake.writes.find(
      (w) =>
        w.op === "update" &&
        w.table === calendarConnections &&
        (w.values as { accessTokenEncrypted?: string }).accessTokenEncrypted
    );
    expect(tokenUpdate?.values).toMatchObject({
      accessTokenEncrypted: "enc:new-access-token",
    });
  });
});

describe("retryPendingPushes", () => {
  it("patches a pending_push link that already has a Google id", async () => {
    fake.queue(calendarConnections, [baseConnection()]);
    fake.queue(eventSyncLinks, [
      {
        link: { id: "link-1", googleEventId: "g-1", pushState: "pending_push" },
        event: {
          id: "evt-1",
          title: "Standup",
          description: null,
          allDay: false,
          startsAt: new Date(),
          endsAt: new Date(),
        },
      },
    ]);

    const patchEvent = vi
      .fn()
      .mockResolvedValue({ etag: '"e2"', updated: "now" });
    const client = fakeClient({ patchEvent });

    await retryPendingPushes("conn-1", client);

    expect(patchEvent).toHaveBeenCalledWith(
      "access-token",
      "cal-1",
      "g-1",
      expect.any(Object)
    );
    const linkUpdate = fake.writes.find(
      (w) => w.op === "update" && w.table === eventSyncLinks
    );
    expect(linkUpdate?.values).toMatchObject({ pushState: "synced" });
  });

  it("inserts (rather than patches) a pending_push link with no Google id yet", async () => {
    fake.queue(calendarConnections, [baseConnection()]);
    fake.queue(eventSyncLinks, [
      {
        link: { id: "link-1", googleEventId: null, pushState: "pending_push" },
        event: {
          id: "evt-1",
          title: "Standup",
          description: null,
          allDay: false,
          startsAt: new Date(),
          endsAt: new Date(),
        },
      },
    ]);

    const insertEvent = vi
      .fn()
      .mockResolvedValue({ id: "g-new", etag: '"e1"', updated: "now" });
    const client = fakeClient({ insertEvent });

    await retryPendingPushes("conn-1", client);

    expect(insertEvent).toHaveBeenCalled();
    const linkUpdate = fake.writes.find(
      (w) => w.op === "update" && w.table === eventSyncLinks
    );
    expect(linkUpdate?.values).toMatchObject({
      googleEventId: "g-new",
      pushState: "synced",
    });
  });

  it("deletes a pending_delete link on Google and removes the row", async () => {
    fake.queue(calendarConnections, [baseConnection()]);
    fake.queue(eventSyncLinks, [
      {
        link: {
          id: "link-1",
          googleEventId: "g-1",
          pushState: "pending_delete",
        },
        event: null,
      },
    ]);

    const deleteEvent = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient({ deleteEvent });

    await retryPendingPushes("conn-1", client);

    expect(deleteEvent).toHaveBeenCalledWith("access-token", "cal-1", "g-1");
    expect(
      fake.writes.some((w) => w.op === "delete" && w.table === eventSyncLinks)
    ).toBe(true);
  });

  it("leaves the link untouched when the retry itself fails", async () => {
    fake.queue(calendarConnections, [baseConnection()]);
    fake.queue(eventSyncLinks, [
      {
        link: { id: "link-1", googleEventId: "g-1", pushState: "pending_push" },
        event: {
          id: "evt-1",
          title: "Standup",
          description: null,
          allDay: false,
          startsAt: new Date(),
          endsAt: new Date(),
        },
      },
    ]);

    const patchEvent = vi.fn().mockRejectedValue(new Error("still down"));
    const client = fakeClient({ patchEvent });

    await retryPendingPushes("conn-1", client);

    expect(
      fake.writes.some((w) => w.op === "update" && w.table === eventSyncLinks)
    ).toBe(false);
  });
});

describe("setupWatchChannel", () => {
  it("is a no-op on localhost (webhooks can't reach it)", async () => {
    const originalUrl = process.env.APP_BASE_URL;
    delete process.env.VERCEL_URL;
    delete process.env.APP_BASE_URL;

    await setupWatchChannel("conn-1");

    // No connection lookup should even happen.
    expect(fake.db.select).not.toHaveBeenCalled();
    process.env.APP_BASE_URL = originalUrl;
  });
});
