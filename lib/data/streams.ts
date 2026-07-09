import "server-only";
import { and, asc, desc, eq, ilike, inArray, notInArray } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  events,
  streamChecklistItems,
  streamChecklistTemplateItems,
  streams,
  type Stream,
  type StreamChecklistItem,
  type StreamChecklistTemplateItem,
} from "@/lib/db/schema";

export interface StreamEventSummary {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
}

export interface StreamSummary {
  id: string;
  title: string;
  retroNotes: string | null;
  createdAt: Date;
  event: StreamEventSummary | null;
  checklistDone: number;
  checklistTotal: number;
}

export interface StreamsOverview {
  /** Soonest first. */
  upcoming: StreamSummary[];
  /** Newest-created first. */
  unscheduled: StreamSummary[];
  /** Most-recent first. */
  past: StreamSummary[];
}

interface ChecklistProgress {
  done: number;
  total: number;
}

/**
 * Pure aggregation, split out so it's unit-testable without a database
 * connection (mirrors `buildIdeaFilterCondition` in `lib/data/ideas.ts`).
 */
export function aggregateChecklistProgress(
  rows: { streamId: string; done: boolean }[]
): Map<string, ChecklistProgress> {
  const result = new Map<string, ChecklistProgress>();
  for (const row of rows) {
    const progress = result.get(row.streamId) ?? { done: 0, total: 0 };
    progress.total += 1;
    if (row.done) progress.done += 1;
    result.set(row.streamId, progress);
  }
  return result;
}

/**
 * Pure bucketing, split out so the upcoming/unscheduled/past split and same-
 * day boundary are unit-testable without a database connection. "Past" is
 * after the linked event's start time, not end-of-day (see
 * docs/content-streams.md).
 */
export function bucketStreams(
  summaries: StreamSummary[],
  now: Date
): StreamsOverview {
  const upcoming: StreamSummary[] = [];
  const unscheduled: StreamSummary[] = [];
  const past: StreamSummary[] = [];

  for (const summary of summaries) {
    if (!summary.event) {
      unscheduled.push(summary);
    } else if (summary.event.startsAt.getTime() > now.getTime()) {
      upcoming.push(summary);
    } else {
      past.push(summary);
    }
  }

  upcoming.sort(
    (a, b) => a.event!.startsAt.getTime() - b.event!.startsAt.getTime()
  );
  past.sort(
    (a, b) => b.event!.startsAt.getTime() - a.event!.startsAt.getTime()
  );
  unscheduled.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return { upcoming, unscheduled, past };
}

interface JoinedEventRow {
  eventId: string | null;
  eventTitle: string | null;
  eventStartsAt: Date | null;
  eventEndsAt: Date | null;
  eventAllDay: boolean | null;
}

/** `eventId` (from `streams`, not the joined table) decides presence — the joined columns are only ever null together with it. */
function toEventSummary(row: JoinedEventRow): StreamEventSummary | null {
  if (!row.eventId) return null;
  return {
    id: row.eventId,
    title: row.eventTitle!,
    startsAt: row.eventStartsAt!,
    endsAt: row.eventEndsAt!,
    allDay: row.eventAllDay!,
  };
}

async function getChecklistProgressForStreams(
  streamIds: string[]
): Promise<Map<string, ChecklistProgress>> {
  if (streamIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({
      streamId: streamChecklistItems.streamId,
      done: streamChecklistItems.done,
    })
    .from(streamChecklistItems)
    .where(inArray(streamChecklistItems.streamId, streamIds));
  return aggregateChecklistProgress(rows);
}

/**
 * Every stream, left-joined to its linked event, batched with a single
 * checklist-progress query (no N+1) and bucketed into
 * upcoming/unscheduled/past (see docs/content-streams.md).
 */
export async function getStreamsOverview(
  now: Date = new Date()
): Promise<StreamsOverview> {
  const db = getDb();

  const rows = await db
    .select({
      stream: streams,
      eventTitle: events.title,
      eventStartsAt: events.startsAt,
      eventEndsAt: events.endsAt,
      eventAllDay: events.allDay,
    })
    .from(streams)
    .leftJoin(events, eq(streams.eventId, events.id));

  const progressByStream = await getChecklistProgressForStreams(
    rows.map((row) => row.stream.id)
  );

  const summaries: StreamSummary[] = rows.map((row) => {
    const progress = progressByStream.get(row.stream.id) ?? {
      done: 0,
      total: 0,
    };
    return {
      id: row.stream.id,
      title: row.stream.title,
      retroNotes: row.stream.retroNotes,
      createdAt: row.stream.createdAt,
      event: toEventSummary({ eventId: row.stream.eventId, ...row }),
      checklistDone: progress.done,
      checklistTotal: progress.total,
    };
  });

  return bucketStreams(summaries, now);
}

export interface StreamWithChecklist {
  stream: Stream;
  event: StreamEventSummary | null;
  checklist: StreamChecklistItem[];
}

export async function getStreamWithChecklist(
  id: string
): Promise<StreamWithChecklist | null> {
  const db = getDb();
  const [row] = await db
    .select({
      stream: streams,
      eventTitle: events.title,
      eventStartsAt: events.startsAt,
      eventEndsAt: events.endsAt,
      eventAllDay: events.allDay,
    })
    .from(streams)
    .leftJoin(events, eq(streams.eventId, events.id))
    .where(eq(streams.id, id));

  if (!row) return null;

  const checklist = await db
    .select()
    .from(streamChecklistItems)
    .where(eq(streamChecklistItems.streamId, id))
    .orderBy(asc(streamChecklistItems.position));

  const event = toEventSummary({ eventId: row.stream.eventId, ...row });

  return { stream: row.stream, event, checklist };
}

export async function getTemplateItems(): Promise<
  StreamChecklistTemplateItem[]
> {
  const db = getDb();
  return db
    .select()
    .from(streamChecklistTemplateItems)
    .orderBy(asc(streamChecklistTemplateItems.position));
}

const ATTACHABLE_EVENT_RESULT_LIMIT = 20;

export interface AttachableEvent {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
}

/**
 * Content-track events not already claimed by another stream, optionally
 * filtered by title — backs the "attach an existing event" picker (the
 * inverse of `searchLinkableIdeas` in `lib/data/idea-event-links.ts`).
 */
export async function searchAttachableEvents(
  query: string
): Promise<AttachableEvent[]> {
  const db = getDb();
  const claimedRows = await db
    .select({ eventId: streams.eventId })
    .from(streams);
  const claimed = claimedRows
    .map((row) => row.eventId)
    .filter((id): id is string => id !== null);

  const trimmed = query.trim();
  const conditions = [eq(events.track, "content")];
  if (claimed.length > 0) conditions.push(notInArray(events.id, claimed));
  if (trimmed) conditions.push(ilike(events.title, `%${trimmed}%`));

  return db
    .select({
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      allDay: events.allDay,
    })
    .from(events)
    .where(and(...conditions))
    .orderBy(desc(events.startsAt))
    .limit(ATTACHABLE_EVENT_RESULT_LIMIT);
}
