import "server-only";
import { and, asc, desc, eq, ilike, inArray, notInArray } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { events, ideaEventLinks, ideas, scripts } from "@/lib/db/schema";
import type { IdeaFormat } from "@/lib/content/idea-format";
import type { IdeaStatus } from "@/lib/content/idea-status";

export interface LinkedIdeaSummary {
  id: string;
  title: string;
  status: IdeaStatus;
  hasScript: boolean;
}

export interface ScheduledEventSummary {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
}

export interface LinkableIdea {
  id: string;
  title: string;
  format: IdeaFormat;
  status: IdeaStatus;
}

/**
 * Linked ideas for a batch of events, one query (no N+1) — `getEventsInRange`
 * fetches a whole range of events at once, and this mirrors that shape so
 * `EventEditor`'s "Linked content" section never needs a per-event round
 * trip (see docs/content-links.md).
 */
export async function getLinkedIdeaSummariesForEvents(
  eventIds: string[]
): Promise<Map<string, LinkedIdeaSummary[]>> {
  const result = new Map<string, LinkedIdeaSummary[]>();
  if (eventIds.length === 0) return result;

  const db = getDb();
  const rows = await db
    .select({
      eventId: ideaEventLinks.eventId,
      ideaId: ideas.id,
      title: ideas.title,
      status: ideas.status,
      scriptContent: scripts.content,
    })
    .from(ideaEventLinks)
    .innerJoin(ideas, eq(ideaEventLinks.ideaId, ideas.id))
    .leftJoin(scripts, eq(scripts.ideaId, ideas.id))
    .where(inArray(ideaEventLinks.eventId, eventIds))
    .orderBy(asc(ideas.title));

  for (const row of rows) {
    const list = result.get(row.eventId) ?? [];
    list.push({
      id: row.ideaId,
      title: row.title,
      status: row.status,
      hasScript: Boolean(row.scriptContent && row.scriptContent !== ""),
    });
    result.set(row.eventId, list);
  }
  return result;
}

/**
 * Scheduled (linked) events for a batch of ideas, chronological — feeds the
 * "Scheduled" section on `IdeaCard`.
 */
export async function getScheduledEventsForIdeas(
  ideaIds: string[]
): Promise<Map<string, ScheduledEventSummary[]>> {
  const result = new Map<string, ScheduledEventSummary[]>();
  if (ideaIds.length === 0) return result;

  const db = getDb();
  const rows = await db
    .select({
      ideaId: ideaEventLinks.ideaId,
      eventId: events.id,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      allDay: events.allDay,
    })
    .from(ideaEventLinks)
    .innerJoin(events, eq(ideaEventLinks.eventId, events.id))
    .where(inArray(ideaEventLinks.ideaId, ideaIds))
    .orderBy(asc(events.startsAt));

  for (const row of rows) {
    const list = result.get(row.ideaId) ?? [];
    list.push({
      id: row.eventId,
      title: row.title,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      allDay: row.allDay,
    });
    result.set(row.ideaId, list);
  }
  return result;
}

const PICKER_RESULT_LIMIT = 20;

/**
 * Ideas not already linked to `eventId`, optionally filtered by title —
 * backs the "Link an idea" picker. Single-user data volume, so a capped,
 * newest-first list needs no pagination (mirrors `getIdeas`'s search shape
 * in `lib/data/ideas.ts`).
 */
export async function searchLinkableIdeas(
  eventId: string,
  query: string
): Promise<LinkableIdea[]> {
  const db = getDb();
  const linkedRows = await db
    .select({ ideaId: ideaEventLinks.ideaId })
    .from(ideaEventLinks)
    .where(eq(ideaEventLinks.eventId, eventId));
  const linkedIds = linkedRows.map((row) => row.ideaId);

  const conditions = [];
  if (linkedIds.length > 0) conditions.push(notInArray(ideas.id, linkedIds));
  const trimmed = query.trim();
  if (trimmed) conditions.push(ilike(ideas.title, `%${trimmed}%`));

  return db
    .select({
      id: ideas.id,
      title: ideas.title,
      format: ideas.format,
      status: ideas.status,
    })
    .from(ideas)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(ideas.createdAt))
    .limit(PICKER_RESULT_LIMIT);
}
