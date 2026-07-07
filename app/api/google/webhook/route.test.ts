// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  connection: undefined as unknown,
}));
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () =>
          dbMock.connection ? [dbMock.connection] : []
        ),
      })),
    })),
  }),
}));
vi.mock("@/lib/google/client", () => ({
  createGoogleCalendarClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/sync/run", () => ({ runInboundSync: vi.fn() }));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn((fn: () => unknown) => fn()) };
});

import { NextRequest } from "next/server";

import { runInboundSync } from "@/lib/sync/run";
import { POST } from "./route";

function webhookRequest(headers: Record<string, string>) {
  return new NextRequest("http://localhost:3000/api/google/webhook", {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.connection = undefined;
});

describe("POST /api/google/webhook", () => {
  it("rejects a request missing the channel headers", async () => {
    const response = await POST(webhookRequest({}));
    expect(response.status).toBe(400);
  });

  it("rejects an unknown channel id", async () => {
    dbMock.connection = undefined;
    const response = await POST(
      webhookRequest({
        "X-Goog-Channel-ID": "chan-1",
        "X-Goog-Channel-Token": "secret",
      })
    );
    expect(response.status).toBe(404);
  });

  it("rejects a channel id with the wrong token", async () => {
    dbMock.connection = {
      id: "conn-1",
      channelId: "chan-1",
      channelToken: "correct-secret",
    };
    const response = await POST(
      webhookRequest({
        "X-Goog-Channel-ID": "chan-1",
        "X-Goog-Channel-Token": "wrong-secret",
      })
    );
    expect(response.status).toBe(404);
  });

  it("acks a valid sync handshake without running a sync", async () => {
    dbMock.connection = {
      id: "conn-1",
      channelId: "chan-1",
      channelToken: "correct-secret",
    };
    const response = await POST(
      webhookRequest({
        "X-Goog-Channel-ID": "chan-1",
        "X-Goog-Channel-Token": "correct-secret",
        "X-Goog-Resource-State": "sync",
      })
    );
    expect(response.status).toBe(200);
    expect(runInboundSync).not.toHaveBeenCalled();
  });

  it("acks a real change notification with the correct token", async () => {
    dbMock.connection = {
      id: "conn-1",
      channelId: "chan-1",
      channelToken: "correct-secret",
    };
    const response = await POST(
      webhookRequest({
        "X-Goog-Channel-ID": "chan-1",
        "X-Goog-Channel-Token": "correct-secret",
        "X-Goog-Resource-State": "exists",
      })
    );
    expect(response.status).toBe(200);
  });
});
