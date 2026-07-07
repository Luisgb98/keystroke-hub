// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  connections: [] as unknown[],
}));
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: vi.fn(() => ({ from: vi.fn(async () => dbMock.connections) })),
  }),
}));
vi.mock("@/lib/google/client", () => ({
  createGoogleCalendarClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/sync/run", () => ({
  runInboundSync: vi.fn(),
  retryPendingPushes: vi.fn(),
  renewWatchChannelIfNeeded: vi.fn(),
}));

import { NextRequest } from "next/server";

import { runInboundSync } from "@/lib/sync/run";
import { GET } from "./route";

function requestWithAuth(header?: string) {
  return new NextRequest("http://localhost:3000/api/cron/calendar-sync", {
    headers: header ? { authorization: header } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.connections = [];
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
});

describe("GET /api/cron/calendar-sync", () => {
  it("rejects a missing Authorization header", async () => {
    const response = await GET(requestWithAuth());
    expect(response.status).toBe(401);
  });

  it("rejects the wrong bearer token", async () => {
    const response = await GET(requestWithAuth("Bearer wrong-secret"));
    expect(response.status).toBe(401);
  });

  it("rejects when CRON_SECRET isn't configured at all", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(requestWithAuth("Bearer test-cron-secret"));
    expect(response.status).toBe(401);
  });

  it("runs a sync pass for every connection with the correct secret", async () => {
    dbMock.connections = [{ id: "conn-1", track: "work" }];

    const response = await GET(requestWithAuth("Bearer test-cron-secret"));

    expect(response.status).toBe(200);
    expect(runInboundSync).toHaveBeenCalledWith("conn-1", expect.any(Object));
    const body = await response.json();
    expect(body.results).toEqual([{ track: "work", ok: true }]);
  });

  it("reports a failed connection without failing the whole run", async () => {
    dbMock.connections = [{ id: "conn-1", track: "work" }];
    vi.mocked(runInboundSync).mockRejectedValueOnce(new Error("sync broke"));

    const response = await GET(requestWithAuth("Bearer test-cron-secret"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toEqual([
      { track: "work", ok: false, error: "sync broke" },
    ]);
  });
});
