import "server-only";
import { asc, count, eq, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { inboxEntries, type InboxEntry } from "@/lib/db/schema";

/** A single untriaged entry, exactly what the inbox list needs to render a card. */
export interface UntriagedEntry {
  id: string;
  body: string;
  createdAt: Date;
}

/**
 * Untriaged entries, oldest-first — the inbox is a FIFO triage queue, so the
 * thing that's been waiting longest sits at the top (see docs/inbox.md).
 * "Untriaged" is `triaged_at IS NULL`; discarded entries carry a `triaged_at`
 * too, so they're excluded by the same filter.
 */
export async function getUntriagedEntries(): Promise<UntriagedEntry[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: inboxEntries.id,
      body: inboxEntries.body,
      createdAt: inboxEntries.createdAt,
    })
    .from(inboxEntries)
    .where(isNull(inboxEntries.triagedAt))
    .orderBy(asc(inboxEntries.createdAt));
  return rows;
}

/**
 * Count of entries still in the inbox — powers the nav/dashboard badge.
 * Same `triaged_at IS NULL` gate as the list, so triaged *and* discarded
 * entries are both excluded.
 */
export async function getUntriagedCount(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ value: count() })
    .from(inboxEntries)
    .where(isNull(inboxEntries.triagedAt));
  return row?.value ?? 0;
}

/** Single entry by id — used by triage to read the body being converted. */
export async function getEntry(id: string): Promise<InboxEntry | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(inboxEntries)
    .where(eq(inboxEntries.id, id));
  return row ?? null;
}
