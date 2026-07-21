"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  events,
  improvements,
  meetingNoteImprovements,
  meetingNotes,
  projects,
} from "@/lib/db/schema";
import {
  searchAttachableEvents as searchAttachableEventsQuery,
  searchLinkableImprovements as searchLinkableImprovementsQuery,
  type AttachableEvent,
  type LinkableImprovement,
} from "@/lib/data/meeting-notes";
import { INITIAL_MEETING_TYPE, type MeetingType } from "./meeting-type";

import {
  meetingNoteCaptureSchema,
  meetingNoteDetailsSchema,
  meetingNoteEventLinkSchema,
  meetingNoteImprovementLinkSchema,
} from "./meeting-note-schema";

export interface MeetingNoteActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  meetingNoteId?: string;
}

export interface MeetingNoteMutationResult {
  error?: string;
}

const VALIDATION_ERROR = "Check the highlighted fields.";
const ARCHIVED_PROJECT_ERROR = "Archived projects can't take new links.";

function revalidateMeetingNotePaths(
  id?: string,
  projectId?: string | null
): void {
  revalidatePath("/projects/meetings");
  if (id) revalidatePath(`/projects/meetings/${id}`);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

/**
 * Rejects an unknown or archived project id — same guard as
 * `checkLinkableProject` in `lib/improvements/actions.ts`. Returns
 * `undefined` when the project id is valid (or absent).
 */
async function checkLinkableProject(
  projectId: string | null
): Promise<string | undefined> {
  if (!projectId) return undefined;

  const db = getDb();
  const [project] = await db
    .select({ id: projects.id, archivedAt: projects.archivedAt })
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) return "That project no longer exists.";
  if (project.archivedAt) return ARCHIVED_PROJECT_ERROR;
  return undefined;
}

function resolveMeetingType(value: string | undefined): MeetingType {
  return value && value.length > 0
    ? (value as MeetingType)
    : INITIAL_MEETING_TYPE;
}

/** Creates a meeting note. Date, title, and notes are the only required fields (see docs/meetings.md). */
export async function createMeetingNote(
  _prevState: MeetingNoteActionState | undefined,
  formData: FormData
): Promise<MeetingNoteActionState> {
  await verifySession();

  const parsed = meetingNoteCaptureSchema.safeParse({
    date: formData.get("date") ?? "",
    title: formData.get("title") ?? "",
    meetingType: formData.get("meetingType") ?? "",
    notes: formData.get("notes") ?? "",
    reflection: formData.get("reflection") ?? "",
    projectId: formData.get("projectId") ?? "",
  });
  if (!parsed.success) {
    return {
      error: VALIDATION_ERROR,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const projectError = await checkLinkableProject(parsed.data.projectId);
  if (projectError) return { error: projectError };

  const db = getDb();
  const id = randomUUID();
  await db.insert(meetingNotes).values({
    id,
    date: parsed.data.date,
    title: parsed.data.title,
    meetingType: parsed.data.meetingType,
    notes: parsed.data.notes,
    reflection: parsed.data.reflection,
    projectId: parsed.data.projectId,
  });

  revalidateMeetingNotePaths(id, parsed.data.projectId);
  return { success: true, meetingNoteId: id };
}

/**
 * Date, title, type, notes, reflection, and the project link are editable
 * here — the linked event and improvements have their own single-purpose
 * attach/detach actions below.
 */
export async function updateMeetingNoteDetails(
  _prevState: MeetingNoteActionState | undefined,
  formData: FormData
): Promise<MeetingNoteActionState> {
  await verifySession();

  const parsed = meetingNoteDetailsSchema.safeParse({
    id: formData.get("id") ?? "",
    date: formData.get("date") ?? "",
    title: formData.get("title") ?? "",
    meetingType: formData.get("meetingType") ?? "",
    notes: formData.get("notes") ?? "",
    reflection: formData.get("reflection") ?? "",
    projectId: formData.get("projectId") ?? "",
  });
  if (!parsed.success) {
    return {
      error: VALIDATION_ERROR,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const reflection =
    parsed.data.reflection && parsed.data.reflection.length > 0
      ? parsed.data.reflection
      : null;
  const projectId =
    parsed.data.projectId && parsed.data.projectId.length > 0
      ? parsed.data.projectId
      : null;

  const projectError = await checkLinkableProject(projectId);
  if (projectError) return { error: projectError };

  const db = getDb();
  const [existing] = await db
    .select({ projectId: meetingNotes.projectId })
    .from(meetingNotes)
    .where(eq(meetingNotes.id, parsed.data.id));
  if (!existing) {
    return { error: "That meeting note no longer exists." };
  }

  await db
    .update(meetingNotes)
    .set({
      date: parsed.data.date,
      title: parsed.data.title,
      meetingType: resolveMeetingType(parsed.data.meetingType),
      notes: parsed.data.notes,
      reflection,
      projectId,
    })
    .where(eq(meetingNotes.id, parsed.data.id));

  revalidateMeetingNotePaths(parsed.data.id, existing.projectId);
  revalidateMeetingNotePaths(parsed.data.id, projectId);
  return { success: true, meetingNoteId: parsed.data.id };
}

/** Deletes a meeting note. Linked improvements survive — only the join rows cascade away. */
export async function deleteMeetingNote(
  id: string
): Promise<MeetingNoteMutationResult> {
  await verifySession();

  const db = getDb();
  const deleted = await db
    .delete(meetingNotes)
    .where(eq(meetingNotes.id, id))
    .returning({ id: meetingNotes.id, projectId: meetingNotes.projectId });

  if (deleted.length === 0) {
    return { error: "That meeting note no longer exists." };
  }

  revalidatePath("/projects/meetings");
  if (deleted[0].projectId) revalidatePath(`/projects/${deleted[0].projectId}`);
  return {};
}

/**
 * Attaches a work-track calendar event to a meeting note — mirrors
 * `attachEventToStream` in `lib/content/stream-actions.ts`, except
 * restricted to the work track and checked against the
 * `meeting_notes_event_id_unique` constraint (one meeting note per event).
 */
export async function attachEventToMeetingNote(
  meetingNoteId: string,
  eventId: string
): Promise<MeetingNoteMutationResult> {
  await verifySession();

  const parsed = meetingNoteEventLinkSchema.safeParse({
    meetingNoteId,
    eventId,
  });
  if (!parsed.success) {
    return { error: "That attachment isn't valid." };
  }

  const db = getDb();
  const [meetingNote] = await db
    .select({ id: meetingNotes.id })
    .from(meetingNotes)
    .where(eq(meetingNotes.id, parsed.data.meetingNoteId));
  if (!meetingNote) {
    return { error: "That meeting note no longer exists." };
  }

  const [event] = await db
    .select({ id: events.id, track: events.track })
    .from(events)
    .where(eq(events.id, parsed.data.eventId));
  if (!event) {
    return { error: "That event no longer exists." };
  }
  if (event.track !== "work") {
    return { error: "Only work-track events can attach to a meeting note." };
  }

  const [claimedBy] = await db
    .select({ id: meetingNotes.id })
    .from(meetingNotes)
    .where(eq(meetingNotes.eventId, parsed.data.eventId));
  if (claimedBy && claimedBy.id !== parsed.data.meetingNoteId) {
    return { error: "That event is already attached to another meeting note." };
  }

  await db
    .update(meetingNotes)
    .set({ eventId: parsed.data.eventId, eventTrack: "work" })
    .where(eq(meetingNotes.id, parsed.data.meetingNoteId));

  revalidateMeetingNotePaths(parsed.data.meetingNoteId);
  return {};
}

export async function detachEventFromMeetingNote(
  meetingNoteId: string
): Promise<MeetingNoteMutationResult> {
  await verifySession();

  const db = getDb();
  const updated = await db
    .update(meetingNotes)
    .set({ eventId: null, eventTrack: null })
    .where(eq(meetingNotes.id, meetingNoteId))
    .returning({ id: meetingNotes.id });

  if (updated.length === 0) {
    return { error: "That meeting note no longer exists." };
  }

  revalidateMeetingNotePaths(meetingNoteId);
  return {};
}

/** Links an improvement to a meeting note — purely referential, no status side-effect (see docs/meetings.md). */
export async function linkImprovementToMeetingNote(
  meetingNoteId: string,
  improvementId: string
): Promise<MeetingNoteMutationResult> {
  await verifySession();

  const parsed = meetingNoteImprovementLinkSchema.safeParse({
    meetingNoteId,
    improvementId,
  });
  if (!parsed.success) {
    return { error: "That link isn't valid." };
  }

  const db = getDb();
  const [improvement] = await db
    .select({ id: improvements.id })
    .from(improvements)
    .where(eq(improvements.id, parsed.data.improvementId));
  if (!improvement) {
    return { error: "That improvement no longer exists." };
  }

  const [existingLink] = await db
    .select({ meetingNoteId: meetingNoteImprovements.meetingNoteId })
    .from(meetingNoteImprovements)
    .where(
      and(
        eq(meetingNoteImprovements.meetingNoteId, parsed.data.meetingNoteId),
        eq(meetingNoteImprovements.improvementId, parsed.data.improvementId)
      )
    );
  if (!existingLink) {
    await db.insert(meetingNoteImprovements).values({
      meetingNoteId: parsed.data.meetingNoteId,
      improvementId: parsed.data.improvementId,
    });
  }

  revalidateMeetingNotePaths(parsed.data.meetingNoteId);
  return {};
}

export async function unlinkImprovementFromMeetingNote(
  meetingNoteId: string,
  improvementId: string
): Promise<MeetingNoteMutationResult> {
  await verifySession();

  const parsed = meetingNoteImprovementLinkSchema.safeParse({
    meetingNoteId,
    improvementId,
  });
  if (!parsed.success) {
    return { error: "That link isn't valid." };
  }

  const db = getDb();
  await db
    .delete(meetingNoteImprovements)
    .where(
      and(
        eq(meetingNoteImprovements.meetingNoteId, parsed.data.meetingNoteId),
        eq(meetingNoteImprovements.improvementId, parsed.data.improvementId)
      )
    );

  revalidateMeetingNotePaths(parsed.data.meetingNoteId);
  return {};
}

/**
 * Backs the event-attach picker: a direct client -> server-action call (same
 * pattern as `searchAttachableEvents` in `lib/content/stream-actions.ts`),
 * since `lib/data/meeting-notes.ts` is `server-only` and can't be imported
 * into a Client Component.
 */
export async function searchAttachableEvents(
  query: string
): Promise<AttachableEvent[]> {
  await verifySession();
  return searchAttachableEventsQuery(query);
}

/** Backs the improvement-link picker — same rationale as `searchAttachableEvents` above. */
export async function searchLinkableImprovements(
  meetingNoteId: string,
  query: string
): Promise<LinkableImprovement[]> {
  await verifySession();
  return searchLinkableImprovementsQuery(meetingNoteId, query);
}
