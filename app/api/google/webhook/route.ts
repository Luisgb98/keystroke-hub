import { eq } from "drizzle-orm";
import { after, type NextRequest } from "next/server";

import { getDb } from "@/lib/db";
import { calendarConnections } from "@/lib/db/schema";
import { createGoogleCalendarClient } from "@/lib/google/client";
import { runInboundSync } from "@/lib/sync/run";

/**
 * Google's push notification receiver for `events.watch` channels — prod
 * only, since webhooks can't reach localhost (open question 6). Not gated
 * by the session proxy (see proxy.ts's matcher); auth is the per-channel
 * `X-Goog-Channel-Token` secret set at watch time (lib/sync/actions.ts).
 * Acks immediately and runs the actual sync in `after()`, since Google
 * expects a fast response and will retry/back off on slow ones.
 */
export async function POST(request: NextRequest) {
  const channelId = request.headers.get("X-Goog-Channel-ID");
  const channelToken = request.headers.get("X-Goog-Channel-Token");
  const resourceState = request.headers.get("X-Goog-Resource-State");

  if (!channelId || !channelToken) {
    return new Response(null, { status: 400 });
  }

  const db = getDb();
  const [connection] = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.channelId, channelId));

  if (!connection || connection.channelToken !== channelToken) {
    return new Response(null, { status: 404 });
  }

  // "sync" is the initial handshake Google sends when the channel is
  // created, not a real change notification — nothing to do yet.
  if (resourceState !== "sync") {
    after(async () => {
      const client = createGoogleCalendarClient();
      try {
        await runInboundSync(connection.id, client);
      } catch {
        // Connection is already marked `status: "error"` by runInboundSync;
        // the cron reconciliation pass will retry.
      }
    });
  }

  return new Response(null, { status: 200 });
}
