"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  events,
  streamChecklistItems,
  streamChecklistTemplateItems,
  streams,
} from "@/lib/db/schema";
import {
  getTemplateItems,
  searchAttachableEvents as searchAttachableEventsQuery,
  type AttachableEvent,
} from "@/lib/data/streams";

import {
  attachEventSchema,
  checklistLabelSchema,
  streamCaptureSchema,
  streamDetailsSchema,
} from "./stream-schema";

export interface StreamActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  streamId?: string;
}

const VALIDATION_ERROR = "Check the highlighted fields.";

function revalidateStreamPaths(id?: string): void {
  revalidatePath("/content/streams");
  if (id) revalidatePath(`/content/streams/${id}`);
  revalidatePath("/calendar");
}

/**
 * Creates a stream, optionally creating its content-track calendar event in
 * the same request, and always snapshotting the current checklist template
 * (copy-on-create — later template edits never touch this stream, see
 * docs/content-streams.md). Event/stream/checklist-item ids are generated
 * here (not left to `defaultRandom()`) so every insert involved can go in one
 * `db.batch()` call — the closest thing to a transaction the neon-http driver
 * offers (it has no interactive `db.transaction()` support).
 */
export async function createStream(
  _prevState: StreamActionState | undefined,
  formData: FormData
): Promise<StreamActionState> {
  await verifySession();

  const parsed = streamCaptureSchema.safeParse({
    title: formData.get("title") ?? "",
    notes: formData.get("notes") ?? "",
    planned: formData.get("planned") === "true",
    allDay: formData.get("allDay") === "true",
    date: formData.get("date") || undefined,
    time: formData.get("time") || undefined,
  });
  if (!parsed.success) {
    return {
      error: VALIDATION_ERROR,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const db = getDb();
  const templateItems = await getTemplateItems();

  const streamId = randomUUID();
  const eventId = parsed.data.schedule ? randomUUID() : null;

  const streamInsert = db.insert(streams).values({
    id: streamId,
    title: parsed.data.title,
    notes: parsed.data.notes,
    eventId,
    eventTrack: eventId ? ("content" as const) : null,
  });

  const checklistValues = templateItems.map((item) => ({
    id: randomUUID(),
    streamId,
    label: item.label,
    position: item.position,
  }));

  if (parsed.data.schedule && eventId) {
    const eventInsert = db.insert(events).values({
      id: eventId,
      track: "content" as const,
      title: parsed.data.title,
      allDay: parsed.data.schedule.allDay,
      startsAt: parsed.data.schedule.startsAt,
      endsAt: parsed.data.schedule.endsAt,
    });
    if (checklistValues.length > 0) {
      await db.batch([
        eventInsert,
        streamInsert,
        db.insert(streamChecklistItems).values(checklistValues),
      ]);
    } else {
      await db.batch([eventInsert, streamInsert]);
    }
  } else if (checklistValues.length > 0) {
    await db.batch([
      streamInsert,
      db.insert(streamChecklistItems).values(checklistValues),
    ]);
  } else {
    await streamInsert;
  }

  revalidateStreamPaths(streamId);
  return { success: true, streamId };
}

export interface StreamDetailsInput {
  id: string;
  title: string;
  notes: string;
  retroNotes: string;
}

/** Empty text clears the column rather than storing `""` — a blank note is "no note". */
function orNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

/**
 * Writes every editable field on the stream detail page in one statement.
 *
 * The page used to carry two Save buttons — one for topic/prep notes, one for
 * the retro — which #102 collapsed into a single one. That makes a single
 * round trip mandatory rather than merely tidy: two sequential writes behind one
 * button could half-land, and the neon-http driver has no interactive
 * transaction to wrap them in (see docs/database.md).
 *
 * Takes a plain object, not `FormData`: the caller `await`s it inside a
 * transition instead of going through `useActionState`, so nothing has to be
 * serialized through a form (see docs/design-system.md).
 */
export async function updateStreamDetails(
  input: StreamDetailsInput
): Promise<StreamActionState> {
  await verifySession();

  const parsed = streamDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: VALIDATION_ERROR,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const db = getDb();
  const updated = await db
    .update(streams)
    .set({
      title: parsed.data.title,
      notes: orNull(parsed.data.notes),
      retroNotes: orNull(parsed.data.retroNotes),
    })
    .where(eq(streams.id, parsed.data.id))
    .returning({ id: streams.id });

  if (updated.length === 0) {
    return { error: "That stream no longer exists." };
  }

  revalidateStreamPaths(parsed.data.id);
  return { success: true, streamId: parsed.data.id };
}

export interface DeleteStreamResult {
  error?: string;
}

/** Hard delete, no soft-archive — matches #15/#11's precedent. Checklist items cascade; the linked event, if any, is left alone. */
export async function deleteStream(id: string): Promise<DeleteStreamResult> {
  await verifySession();

  const db = getDb();
  const deleted = await db
    .delete(streams)
    .where(eq(streams.id, id))
    .returning({ id: streams.id });

  if (deleted.length === 0) {
    return { error: "That stream no longer exists." };
  }

  revalidateStreamPaths();
  return {};
}

export interface ChecklistItemResult {
  error?: string;
}

/** Shared toggle for per-stream checklist rows — idempotent (setting the same value twice is a no-op success). */
export async function toggleChecklistItem(
  streamId: string,
  itemId: string,
  done: boolean
): Promise<ChecklistItemResult> {
  await verifySession();

  const db = getDb();
  const updated = await db
    .update(streamChecklistItems)
    .set({ done })
    .where(
      and(
        eq(streamChecklistItems.id, itemId),
        eq(streamChecklistItems.streamId, streamId)
      )
    )
    .returning({ id: streamChecklistItems.id });

  if (updated.length === 0) {
    return { error: "That checklist item no longer exists." };
  }

  revalidatePath(`/content/streams/${streamId}`);
  return {};
}

async function nextPosition(
  positions: { position: number }[]
): Promise<number> {
  return positions.reduce((max, row) => Math.max(max, row.position), -1) + 1;
}

/** Appends a per-stream checklist item — local to this stream, never touches the template. */
export async function addChecklistItem(
  streamId: string,
  label: string
): Promise<ChecklistItemResult> {
  await verifySession();

  const parsedLabel = checklistLabelSchema.safeParse(label);
  if (!parsedLabel.success) {
    return {
      error: parsedLabel.error.issues[0]?.message ?? "That item isn't valid.",
    };
  }

  const db = getDb();
  const [stream] = await db
    .select({ id: streams.id })
    .from(streams)
    .where(eq(streams.id, streamId));
  if (!stream) {
    return { error: "That stream no longer exists." };
  }

  const existing = await db
    .select({ position: streamChecklistItems.position })
    .from(streamChecklistItems)
    .where(eq(streamChecklistItems.streamId, streamId));

  await db.insert(streamChecklistItems).values({
    streamId,
    label: parsedLabel.data,
    position: await nextPosition(existing),
  });

  revalidatePath(`/content/streams/${streamId}`);
  return {};
}

export async function removeChecklistItem(
  streamId: string,
  itemId: string
): Promise<ChecklistItemResult> {
  await verifySession();

  const db = getDb();
  await db
    .delete(streamChecklistItems)
    .where(
      and(
        eq(streamChecklistItems.id, itemId),
        eq(streamChecklistItems.streamId, streamId)
      )
    );

  revalidatePath(`/content/streams/${streamId}`);
  return {};
}

export interface TemplateItemResult {
  error?: string;
}

/** Template edits are copy-on-create only — never retroactively rewrite an existing stream's checklist (see docs/content-streams.md). */
export async function addTemplateItem(
  label: string
): Promise<TemplateItemResult> {
  await verifySession();

  const parsedLabel = checklistLabelSchema.safeParse(label);
  if (!parsedLabel.success) {
    return {
      error: parsedLabel.error.issues[0]?.message ?? "That item isn't valid.",
    };
  }

  const db = getDb();
  const existing = await db
    .select({ position: streamChecklistTemplateItems.position })
    .from(streamChecklistTemplateItems);

  await db.insert(streamChecklistTemplateItems).values({
    label: parsedLabel.data,
    position: await nextPosition(existing),
  });

  revalidatePath("/content/streams");
  return {};
}

export async function removeTemplateItem(
  id: string
): Promise<TemplateItemResult> {
  await verifySession();

  const db = getDb();
  await db
    .delete(streamChecklistTemplateItems)
    .where(eq(streamChecklistTemplateItems.id, id));

  revalidatePath("/content/streams");
  return {};
}

export interface AttachEventResult {
  error?: string;
}

/**
 * Attaches an existing content-track event to a stream — the inverse of
 * `linkIdeaToEvent` in `lib/content/link-actions.ts`. `unique(event_id)` on
 * `streams` is what makes "one stream per event" true at the DB level; the
 * check below exists for a friendly, UI-facing message instead of a raw
 * constraint-violation error.
 */
export async function attachEventToStream(
  streamId: string,
  eventId: string
): Promise<AttachEventResult> {
  await verifySession();

  const parsed = attachEventSchema.safeParse({ streamId, eventId });
  if (!parsed.success) {
    return { error: "That attachment isn't valid." };
  }

  const db = getDb();
  const [stream] = await db
    .select({ id: streams.id })
    .from(streams)
    .where(eq(streams.id, parsed.data.streamId));
  if (!stream) {
    return { error: "That stream no longer exists." };
  }

  const [event] = await db
    .select({ id: events.id, track: events.track })
    .from(events)
    .where(eq(events.id, parsed.data.eventId));
  if (!event) {
    return { error: "That event no longer exists." };
  }
  if (event.track !== "content") {
    return { error: "Only content-track events can attach to a stream." };
  }

  const [claimedBy] = await db
    .select({ id: streams.id })
    .from(streams)
    .where(eq(streams.eventId, parsed.data.eventId));
  if (claimedBy && claimedBy.id !== parsed.data.streamId) {
    return { error: "That event is already attached to another stream." };
  }

  await db
    .update(streams)
    .set({ eventId: parsed.data.eventId, eventTrack: "content" })
    .where(eq(streams.id, parsed.data.streamId));

  revalidateStreamPaths(parsed.data.streamId);
  return {};
}

/** Unschedules a stream without deleting it — the event itself is untouched. */
export async function detachEventFromStream(
  streamId: string
): Promise<AttachEventResult> {
  await verifySession();

  const db = getDb();
  const updated = await db
    .update(streams)
    .set({ eventId: null, eventTrack: null })
    .where(eq(streams.id, streamId))
    .returning({ id: streams.id });

  if (updated.length === 0) {
    return { error: "That stream no longer exists." };
  }

  revalidateStreamPaths(streamId);
  return {};
}

/**
 * Backs the event-attach picker: a direct client -> server-action call (same
 * pattern as `searchLinkableIdeas` in `lib/content/link-actions.ts`), since
 * `lib/data/streams.ts` is `server-only` and can't be imported into a Client
 * Component.
 */
export async function searchAttachableEvents(
  query: string
): Promise<AttachableEvent[]> {
  await verifySession();
  return searchAttachableEventsQuery(query);
}
