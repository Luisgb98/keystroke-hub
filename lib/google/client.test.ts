// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SyncTokenExpiredError, createGoogleCalendarClient } from "./client";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createGoogleCalendarClient", () => {
  it("listCalendars sends a bearer token and returns the items array", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [{ id: "primary", summary: "Owner", primary: true }],
      })
    );
    const client = createGoogleCalendarClient();

    const calendars = await client.listCalendars("token-123");

    expect(calendars).toEqual([
      { id: "primary", summary: "Owner", primary: true },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/users/me/calendarList");
    expect(init.headers.Authorization).toBe("Bearer token-123");
  });

  it("listEvents passes syncToken and singleEvents, and returns pagination tokens", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [],
        nextPageToken: "page-2",
        nextSyncToken: "sync-9",
      })
    );
    const client = createGoogleCalendarClient();

    const page = await client.listEvents("token", "cal-1", {
      syncToken: "sync-8",
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("syncToken=sync-8");
    expect(url).toContain("singleEvents=true");
    expect(page.nextPageToken).toBe("page-2");
    expect(page.nextSyncToken).toBe("sync-9");
  });

  it("listEvents throws SyncTokenExpiredError on 410", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 410 }));
    const client = createGoogleCalendarClient();

    await expect(
      client.listEvents("token", "cal-1", { syncToken: "stale" })
    ).rejects.toBeInstanceOf(SyncTokenExpiredError);
  });

  it("insertEvent POSTs the payload and returns the created event", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "g-1",
        etag: '"e1"',
        status: "confirmed",
        updated: "now",
      })
    );
    const client = createGoogleCalendarClient();

    const created = await client.insertEvent("token", "cal-1", {
      summary: "New",
    });

    expect(created.id).toBe("g-1");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ summary: "New" });
  });

  it("patchEvent PATCHes the event by id", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "g-1",
        etag: '"e2"',
        status: "confirmed",
        updated: "now",
      })
    );
    const client = createGoogleCalendarClient();

    await client.patchEvent("token", "cal-1", "g-1", { summary: "Updated" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/events/g-1");
    expect(init.method).toBe("PATCH");
  });

  it("deleteEvent tolerates an already-deleted (404/410) event", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 410 }));
    const client = createGoogleCalendarClient();

    await expect(
      client.deleteEvent("token", "cal-1", "g-1")
    ).resolves.toBeUndefined();
  });

  it("deleteEvent throws on a genuine server error", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const client = createGoogleCalendarClient();

    await expect(client.deleteEvent("token", "cal-1", "g-1")).rejects.toThrow();
  });

  it("watchEvents POSTs a web_hook channel and returns the resource id/expiration", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ resourceId: "res-1", expiration: "123456" })
    );
    const client = createGoogleCalendarClient();

    const result = await client.watchEvents("token", "cal-1", {
      id: "chan-1",
      address: "https://example.com/api/google/webhook",
      token: "chan-token",
      expirationMs: 123456,
    });

    expect(result).toEqual({ resourceId: "res-1", expiration: "123456" });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({
      type: "web_hook",
      id: "chan-1",
    });
  });

  it("stopChannel tolerates a 404 (already stopped)", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const client = createGoogleCalendarClient();

    await expect(
      client.stopChannel("token", "chan-1", "res-1")
    ).resolves.toBeUndefined();
  });
});
