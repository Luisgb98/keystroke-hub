import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/lib/db";
import {
  eventSyncLinks,
  events,
  streamChecklistItems,
  streamChecklistTemplateItems,
  streams,
} from "@/lib/db/schema";
import { resolveGameId } from "@/lib/data/games";
import { getTemplateItems } from "@/lib/data/streams";
import { pushEventDeleted } from "@/lib/sync/push";
import { schedulePush } from "@/lib/sync/schedule";

import { insertStreamSession } from "../stream-session";
import {
  attachEventSchema,
  checklistLabelSchema,
  streamCaptureSchema,
  streamDetailsSchema,
} from "../stream-schema";

/**
 * The stream-planner domain, free of any transport — see `lib/content/core/ideas.ts`
 * for the split's rationale. `lib/content/stream-actions.ts` adds the session
 * gate for the UI, `lib/mcp/tools/streams.ts` the MCP surface (issue #109).
 */

export interface StreamActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  streamId?: string;
}

export const VALIDATION_ERROR = "Check the highlighted fields.";

function revalidateStreamPaths(id?: string): void {
  revalidatePath("/content/streams");
  if (id) revalidatePath(`/content/streams/${id}`);
  revalidatePath("/calendar");
}

/** Form-shaped capture input, exactly the fields the create dialog submits. */
export interface RawStreamCaptureInput {
  title?: string;
  notes?: string;
  gameId?: string;
  planned: boolean;
  allDay?: boolean;
  date?: string;
  time?: string;
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
export async function createStreamCore(
  raw: RawStreamCaptureInput
): Promise<StreamActionState> {
  const parsed = streamCaptureSchema.safeParse({
    title: raw.title ?? "",
    notes: raw.notes ?? "",
    gameId: raw.gameId ?? "",
    planned: raw.planned,
    allDay: raw.allDay ?? false,
    date: raw.date || undefined,
    time: raw.time || undefined,
  });
  if (!parsed.success) {
    return {
      error: VALIDATION_ERROR,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const db = getDb();
  const { schedule } = parsed.data;
  // A game the client named but that no longer exists degrades to "no game"
  // rather than failing the capture on a foreign-key violation (#105).
  const gameId = await resolveGameId(parsed.data.gameId);

  if (schedule) {
    const eventId = randomUUID();
    const streamId = await insertStreamSession({
      eventId,
      title: parsed.data.title,
      notes: parsed.data.notes,
      gameId,
      leading: db.insert(events).values({
        id: eventId,
        track: "content" as const,
        title: parsed.data.title,
        allDay: schedule.allDay,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
      }),
    });
    revalidateStreamPaths(streamId);
    return { success: true, streamId };
  }

  // Unscheduled: no event to point at, so the template snapshot is the only
  // thing batched alongside the stream row.
  const templateItems = await getTemplateItems();
  const streamId = randomUUID();
  const streamInsert = db.insert(streams).values({
    id: streamId,
    title: parsed.data.title,
    notes: parsed.data.notes,
    gameId,
    eventId: null,
    eventTrack: null,
  });
  const checklistValues = templateItems.map((item) => ({
    id: randomUUID(),
    streamId,
    label: item.label,
    position: item.position,
  }));

  if (checklistValues.length > 0) {
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
  /** The picked library entry, or "" for no game (#105). */
  gameId: string;
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
 */
export async function updateStreamDetailsCore(
  input: StreamDetailsInput
): Promise<StreamActionState> {
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
      gameId: await resolveGameId(parsed.data.gameId),
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

/**
 * Hard delete, no soft-archive — matches #15/#11's precedent. Checklist items
 * cascade.
 *
 * The linked calendar event goes with it (issue #104). It used to be left
 * alone, which was defensible while a stream's block was an ordinary content
 * chip; now that the block advertises a session in Twitch purple, an orphan
 * left behind would be a block promising a session that no longer exists. The
 * two deletes are batched so the block can't outlive the session, and the
 * Google-side delete is pushed the same way `deleteEventCore` pushes it.
 */
export async function deleteStreamCore(
  id: string
): Promise<DeleteStreamResult> {
  const db = getDb();
  const [stream] = await db
    .select({ id: streams.id, eventId: streams.eventId })
    .from(streams)
    .where(eq(streams.id, id));

  if (!stream) {
    return { error: "That stream no longer exists." };
  }

  const eventId = stream.eventId;
  // Captured before the delete: `event_sync_links.event_id` auto-nulls via
  // `ON DELETE SET NULL` the moment the event row is gone (lib/db/schema.ts).
  const [link] = eventId
    ? await db
        .select()
        .from(eventSyncLinks)
        .where(eq(eventSyncLinks.eventId, eventId))
    : [];

  if (eventId) {
    await db.batch([
      db.delete(streams).where(eq(streams.id, id)),
      db.delete(events).where(eq(events.id, eventId)),
    ]);
  } else {
    await db.delete(streams).where(eq(streams.id, id));
  }

  revalidateStreamPaths();
  if (link) {
    schedulePush(() =>
      pushEventDeleted(link.id, link.googleEventId, "content")
    );
  }
  return {};
}

export interface ChecklistItemResult {
  error?: string;
}

/** Shared toggle for per-stream checklist rows — idempotent (setting the same value twice is a no-op success). */
export async function toggleChecklistItemCore(
  streamId: string,
  itemId: string,
  done: boolean
): Promise<ChecklistItemResult> {
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

function nextPosition(positions: { position: number }[]): number {
  return positions.reduce((max, row) => Math.max(max, row.position), -1) + 1;
}

/** Appends a per-stream checklist item — local to this stream, never touches the template. */
export async function addChecklistItemCore(
  streamId: string,
  label: string
): Promise<ChecklistItemResult> {
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
    position: nextPosition(existing),
  });

  revalidatePath(`/content/streams/${streamId}`);
  return {};
}

export async function removeChecklistItemCore(
  streamId: string,
  itemId: string
): Promise<ChecklistItemResult> {
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
export async function addTemplateItemCore(
  label: string
): Promise<TemplateItemResult> {
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
    position: nextPosition(existing),
  });

  revalidatePath("/content/streams");
  return {};
}

export async function removeTemplateItemCore(
  id: string
): Promise<TemplateItemResult> {
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
 * `linkIdeaToEventCore` in `lib/content/core/links.ts`. `unique(event_id)` on
 * `streams` is what makes "one stream per event" true at the DB level; the
 * check below exists for a friendly, UI-facing message instead of a raw
 * constraint-violation error. Work-track events are refused outright, which is
 * also what keeps the work world out of reach through MCP (issue #109).
 */
export async function attachEventToStreamCore(
  streamId: string,
  eventId: string
): Promise<AttachEventResult> {
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
export async function detachEventFromStreamCore(
  streamId: string
): Promise<AttachEventResult> {
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
