import "server-only";
import { randomUUID } from "node:crypto";
import type { BatchItem } from "drizzle-orm/batch";

import { getTemplateItems } from "@/lib/data/streams";
import { getDb } from "@/lib/db";
import { streamChecklistItems, streams } from "@/lib/db/schema";

/**
 * Creates the stream session behind a content-track event, snapshotting the
 * current checklist template onto it (copy-on-create — see
 * docs/content-streams.md).
 *
 * Shared by `createStream`/`updateEvent`/`createEvent` so that a purple block
 * always has a real session behind it however it was planned, seeded the same
 * way from the same template (issue #104). `leading` lets a caller put the
 * event's own INSERT at the head of the batch, which is what makes
 * "create the event and its session" a single Neon round trip — the closest
 * this driver gets to a transaction (docs/database.md).
 */
export async function insertStreamSession({
  eventId,
  title,
  notes = null,
  gameId = null,
  leading,
}: {
  eventId: string;
  title: string;
  notes?: string | null;
  /** Already resolved against the library by the caller (see `resolveGameId`). */
  gameId?: string | null;
  leading?: BatchItem<"pg">;
}): Promise<string> {
  const db = getDb();
  const templateItems = await getTemplateItems();
  const streamId = randomUUID();

  const streamInsert = db.insert(streams).values({
    id: streamId,
    title,
    notes,
    gameId,
    eventId,
    eventTrack: "content" as const,
  });

  const checklistValues = templateItems.map((item) => ({
    id: randomUUID(),
    streamId,
    label: item.label,
    position: item.position,
  }));

  const queries: BatchItem<"pg">[] = [];
  if (leading) queries.push(leading);
  queries.push(streamInsert);
  if (checklistValues.length > 0) {
    queries.push(db.insert(streamChecklistItems).values(checklistValues));
  }

  if (queries.length === 1) {
    await queries[0];
  } else {
    await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  }

  return streamId;
}
