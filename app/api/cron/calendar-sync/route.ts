import type { NextRequest } from "next/server";

import { getDb } from "@/lib/db";
import { calendarConnections } from "@/lib/db/schema";
import { createGoogleCalendarClient } from "@/lib/google/client";
import {
  renewWatchChannelIfNeeded,
  retryPendingPushes,
  runInboundSync,
} from "@/lib/sync/run";

/**
 * Reconciliation safety net (see docs/google-sync.md): re-runs inbound sync
 * for every connection (covers missed/failed webhooks and *is* the only
 * sync mechanism in local dev, open question 6), retries pending outbound
 * pushes, and renews watch channels nearing expiry. Not gated by the
 * session proxy (see proxy.ts's matcher) — Vercel Cron calls it directly
 * with a bearer `CRON_SECRET`, which is the auth here.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(null, { status: 401 });
  }

  const db = getDb();
  const connections = await db.select().from(calendarConnections);
  const client = createGoogleCalendarClient();

  const results = [];
  for (const connection of connections) {
    try {
      await runInboundSync(connection.id, client);
      await retryPendingPushes(connection.id, client);
      await renewWatchChannelIfNeeded(connection, client);
      results.push({ track: connection.track, ok: true });
    } catch (error) {
      results.push({
        track: connection.track,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return Response.json({ ranAt: new Date().toISOString(), results });
}
