import "server-only";
import { and, desc, eq, ilike, notInArray, or } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  events,
  improvements,
  meetingNoteImprovements,
  meetingNotes,
  projects,
} from "@/lib/db/schema";
import type { MeetingType } from "@/lib/meetings/meeting-type";
import type { ImprovementStatus } from "@/lib/improvements/improvement-status";

export interface MeetingNoteSummary {
  id: string;
  date: string;
  title: string;
  meetingType: MeetingType;
  reflection: string | null;
  projectId: string | null;
  projectName: string | null;
  eventId: string | null;
  linkedImprovementCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Pure sort, split out so it's unit-testable without a database connection (mirrors `sortProjectSummaries`). Same-day meetings tiebreak by most-recently-created. */
export function sortMeetingNotes(
  summaries: MeetingNoteSummary[]
): MeetingNoteSummary[] {
  return [...summaries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/** Pure aggregation, split out so it's unit-testable without a database connection (mirrors `aggregateLinkedIdeaCounts` in `lib/data/projects.ts`). */
export function aggregateLinkedImprovementCounts(
  rows: { meetingNoteId: string }[]
): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) {
    result.set(row.meetingNoteId, (result.get(row.meetingNoteId) ?? 0) + 1);
  }
  return result;
}

/**
 * Chronological (newest first) meeting notes, project chip data and a
 * linked-improvement count joined in (no N+1), optionally filtered by a
 * case-insensitive match across title, notes, and reflection (see
 * docs/meetings.md).
 */
export async function listMeetingNotes(
  query?: string
): Promise<MeetingNoteSummary[]> {
  const db = getDb();
  const trimmed = query?.trim();

  const conditions = trimmed
    ? [
        or(
          ilike(meetingNotes.title, `%${trimmed}%`),
          ilike(meetingNotes.notes, `%${trimmed}%`),
          ilike(meetingNotes.reflection, `%${trimmed}%`)
        ),
      ]
    : [];

  const rows = await db
    .select({
      id: meetingNotes.id,
      date: meetingNotes.date,
      title: meetingNotes.title,
      meetingType: meetingNotes.meetingType,
      reflection: meetingNotes.reflection,
      projectId: meetingNotes.projectId,
      projectName: projects.name,
      eventId: meetingNotes.eventId,
      createdAt: meetingNotes.createdAt,
      updatedAt: meetingNotes.updatedAt,
    })
    .from(meetingNotes)
    .leftJoin(projects, eq(meetingNotes.projectId, projects.id))
    .where(and(...conditions));

  const linkRows = await db
    .select({ meetingNoteId: meetingNoteImprovements.meetingNoteId })
    .from(meetingNoteImprovements);
  const countByMeetingNote = aggregateLinkedImprovementCounts(linkRows);

  const summaries: MeetingNoteSummary[] = rows.map((row) => ({
    ...row,
    linkedImprovementCount: countByMeetingNote.get(row.id) ?? 0,
  }));

  return sortMeetingNotes(summaries);
}

export interface LinkedEventSummary {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
}

export interface LinkedImprovementSummary {
  id: string;
  title: string;
  status: ImprovementStatus;
}

export interface MeetingNoteWithLinks {
  id: string;
  date: string;
  title: string;
  meetingType: MeetingType;
  notes: string;
  reflection: string | null;
  projectId: string | null;
  projectName: string | null;
  eventId: string | null;
  createdAt: Date;
  updatedAt: Date;
  event: LinkedEventSummary | null;
  linkedImprovements: LinkedImprovementSummary[];
}

/** A single meeting note plus its linked project name, event, and improvements — backs the detail page. */
export async function getMeetingNote(
  id: string
): Promise<MeetingNoteWithLinks | null> {
  const db = getDb();

  const [row] = await db
    .select({
      id: meetingNotes.id,
      date: meetingNotes.date,
      title: meetingNotes.title,
      meetingType: meetingNotes.meetingType,
      notes: meetingNotes.notes,
      reflection: meetingNotes.reflection,
      projectId: meetingNotes.projectId,
      projectName: projects.name,
      eventId: meetingNotes.eventId,
      eventTitle: events.title,
      eventStartsAt: events.startsAt,
      eventEndsAt: events.endsAt,
      eventAllDay: events.allDay,
      createdAt: meetingNotes.createdAt,
      updatedAt: meetingNotes.updatedAt,
    })
    .from(meetingNotes)
    .leftJoin(projects, eq(meetingNotes.projectId, projects.id))
    .leftJoin(events, eq(meetingNotes.eventId, events.id))
    .where(eq(meetingNotes.id, id));

  if (!row) return null;

  const linkedImprovements = await getImprovementsForMeetingNote(id);

  return {
    id: row.id,
    date: row.date,
    title: row.title,
    meetingType: row.meetingType,
    notes: row.notes,
    reflection: row.reflection,
    projectId: row.projectId,
    projectName: row.projectName,
    eventId: row.eventId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    event:
      row.eventId && row.eventTitle && row.eventStartsAt && row.eventEndsAt
        ? {
            id: row.eventId,
            title: row.eventTitle,
            startsAt: row.eventStartsAt,
            endsAt: row.eventEndsAt,
            allDay: row.eventAllDay ?? false,
          }
        : null,
    linkedImprovements,
  };
}

/** Improvements linked to a given meeting note, newest-linked-first is not tracked — ordered by improvement creation instead. */
export async function getImprovementsForMeetingNote(
  meetingNoteId: string
): Promise<LinkedImprovementSummary[]> {
  const db = getDb();
  return db
    .select({
      id: improvements.id,
      title: improvements.title,
      status: improvements.status,
    })
    .from(meetingNoteImprovements)
    .innerJoin(
      improvements,
      eq(meetingNoteImprovements.improvementId, improvements.id)
    )
    .where(eq(meetingNoteImprovements.meetingNoteId, meetingNoteId))
    .orderBy(desc(improvements.createdAt));
}

export interface MeetingNoteSummaryForProject {
  id: string;
  date: string;
  title: string;
}

/** Meeting notes linked to a given project, newest first — backs a `ProjectMeetingNotes` sibling section on `/projects/[id]`. */
export async function getMeetingNotesForProject(
  projectId: string
): Promise<MeetingNoteSummaryForProject[]> {
  const db = getDb();
  return db
    .select({
      id: meetingNotes.id,
      date: meetingNotes.date,
      title: meetingNotes.title,
    })
    .from(meetingNotes)
    .where(eq(meetingNotes.projectId, projectId))
    .orderBy(desc(meetingNotes.date), desc(meetingNotes.createdAt));
}

const PICKER_RESULT_LIMIT = 20;

export interface AttachableEvent {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
}

/**
 * Work-track events not already claimed by another meeting note (the
 * `meeting_notes_event_id_unique` constraint enforces at most one meeting
 * note per event — see docs/meetings.md), optionally filtered by title.
 */
export async function searchAttachableEvents(
  query: string
): Promise<AttachableEvent[]> {
  const db = getDb();
  const claimedRows = await db
    .select({ eventId: meetingNotes.eventId })
    .from(meetingNotes);
  const claimed = claimedRows
    .map((row) => row.eventId)
    .filter((id): id is string => id !== null);

  const trimmed = query.trim();
  const conditions = [eq(events.track, "work")];
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
    .limit(PICKER_RESULT_LIMIT);
}

export interface LinkableImprovement {
  id: string;
  title: string;
  status: ImprovementStatus;
}

/** Improvements not yet linked to this meeting note, optionally filtered by title — backs the "link an improvement" picker. */
export async function searchLinkableImprovements(
  meetingNoteId: string,
  query: string
): Promise<LinkableImprovement[]> {
  const db = getDb();
  const linkedRows = await db
    .select({ improvementId: meetingNoteImprovements.improvementId })
    .from(meetingNoteImprovements)
    .where(eq(meetingNoteImprovements.meetingNoteId, meetingNoteId));
  const linked = linkedRows.map((row) => row.improvementId);

  const trimmed = query.trim();
  const conditions =
    linked.length > 0 ? [notInArray(improvements.id, linked)] : [];
  if (trimmed) conditions.push(ilike(improvements.title, `%${trimmed}%`));

  return db
    .select({
      id: improvements.id,
      title: improvements.title,
      status: improvements.status,
    })
    .from(improvements)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(improvements.createdAt))
    .limit(PICKER_RESULT_LIMIT);
}
