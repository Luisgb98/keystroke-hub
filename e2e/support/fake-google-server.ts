#!/usr/bin/env node
// A minimal stand-in for the Google OAuth token + Calendar REST endpoints,
// run as a second Playwright `webServer` entry (see playwright.config.ts).
// Real Google OAuth isn't automatable in CI (docs/google-sync.md), and the
// app's Google calls all happen server-side, so Playwright's page-level
// route interception can't reach them — pointing
// `GOOGLE_CALENDAR_API_BASE_URL` / `GOOGLE_OAUTH_TOKEN_BASE_URL` at this
// server instead is the env-gated fake-client approach the issue #12 plan
// calls for.
//
// State (the next `events.list` response) is controlled per-test via the
// `/__control/*` endpoints — see e2e/support/fake-google.ts.
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

// Explicit extension: this file is executed directly via plain `node`
// (playwright.config.ts's webServer), whose ESM resolver — unlike
// Playwright's own esbuild-based TS transform for spec files — requires it.
import { FAKE_GOOGLE_PORT } from "./credentials.ts";

interface EventsListResponse {
  items: unknown[];
  nextSyncToken?: string;
  nextPageToken?: string;
}

let nextEventsResponse: EventsListResponse = {
  items: [],
  nextSyncToken: "fake-sync-token-1",
};

function send(res: ServerResponse, status: number, body?: unknown) {
  if (body === undefined) {
    res.writeHead(status);
    res.end();
    return;
  }
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(
  req: IncomingMessage
): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${FAKE_GOOGLE_PORT}`);
  const method = req.method ?? "GET";
  const body = await readJsonBody(req);

  // --- Test control ---
  if (url.pathname === "/__control/set-events" && method === "POST") {
    nextEventsResponse = body as unknown as EventsListResponse;
    return send(res, 200, { ok: true });
  }
  if (url.pathname === "/__control/reset" && method === "POST") {
    nextEventsResponse = { items: [], nextSyncToken: "fake-sync-token-1" };
    return send(res, 200, { ok: true });
  }
  if (url.pathname === "/__control/health") {
    return send(res, 200, { ok: true });
  }

  // --- OAuth token endpoints (not exercised by e2e — real consent is a
  // browser redirect that isn't automated — kept for completeness/future use) ---
  if (url.pathname === "/token" && method === "POST") {
    return send(res, 200, {
      access_token: "fake-access-token",
      refresh_token: "fake-refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
    });
  }
  if (url.pathname === "/revoke" && method === "POST") {
    return send(res, 200, {});
  }

  // --- Calendar REST surface ---
  if (url.pathname === "/users/me/calendarList") {
    return send(res, 200, {
      items: [{ id: "primary", summary: "owner@example.com", primary: true }],
    });
  }

  const eventsCollection = /\/calendars\/[^/]+\/events$/;
  const eventsWatch = /\/calendars\/[^/]+\/events\/watch$/;
  const eventItem = /\/calendars\/[^/]+\/events\/([^/]+)$/;

  if (eventsWatch.test(url.pathname) && method === "POST") {
    return send(res, 200, {
      resourceId: "fake-resource-id",
      expiration: String(Date.now() + 3600_000),
    });
  }

  if (eventsCollection.test(url.pathname) && method === "GET") {
    return send(res, 200, nextEventsResponse);
  }

  if (eventsCollection.test(url.pathname) && method === "POST") {
    return send(res, 200, {
      id: `fake-${Date.now()}`,
      status: "confirmed",
      etag: `"${Date.now()}"`,
      updated: new Date().toISOString(),
      ...body,
    });
  }

  const itemMatch = url.pathname.match(eventItem);
  if (itemMatch && method === "PATCH") {
    return send(res, 200, {
      id: itemMatch[1],
      status: "confirmed",
      etag: `"${Date.now()}"`,
      updated: new Date().toISOString(),
      ...body,
    });
  }
  if (itemMatch && method === "DELETE") {
    return send(res, 204);
  }

  if (url.pathname === "/channels/stop" && method === "POST") {
    return send(res, 200, {});
  }

  send(res, 404, {
    error: `fake-google-server: no handler for ${method} ${url.pathname}`,
  });
});

server.listen(FAKE_GOOGLE_PORT, () => {
  console.log(
    `Fake Google server listening on http://127.0.0.1:${FAKE_GOOGLE_PORT}`
  );
});
