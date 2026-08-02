"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifySession } from "@/lib/auth/session";
import { insertStreamSession } from "@/lib/content/stream-session";
import { getDb } from "@/lib/db";
import {
  eventSyncLinks,
  events,
  ideaEventLinks,
  meetingNotes,
  streams,
} from "@/lib/db/schema";
import {
  pushEventCreated,
  pushEventDeleted,
  pushEventUpdated,
} from "@/lib/sync/push";
import { schedulePush } from "@/lib/sync/schedule";

import { eventFormSchema, rescheduleSchema } from "./event-schema";

export interface EventActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

function parseEventForm(formData: FormData) {
  return eventFormSchema.safeParse({
    title: formData.get("title") ?? "",
    track: formData.get("track") || undefined,
    description: formData.get("description") ?? "",
    allDay: formData.get("allDay") === "true",
    startDate: formData.get("startDate") ?? "",
    startTime: formData.get("startTime") || undefined,
    endDate: formData.get("endDate") ?? "",
    endTime: formData.get("endTime") || undefined,
  });
}

const VALIDATION_ERROR = "Check the highlighted fields.";

/** Both stream-planner routes, refreshed whenever a calendar write moves a session. */
function revalidateStreamPaths(streamId?: string): void {
  revalidatePath("/content/streams");
  if (streamId) revalidatePath(`/content/streams/${streamId}`);
}

export async function createEvent(
  _prevState: EventActionState | undefined,
  formData: FormData
): Promise<EventActionState> {
  await verifySession();

  const parsed = parseEventForm(formData);
  if (!parsed.success) {
    return {
      error: VALIDATION_ERROR,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const db = getDb();
  const { kind, ...values } = parsed.data;

  // Picking Stream creates the session behind the block in the same request,
  // checklist seeded from the current template (issue #104) — a purple block
  // always corresponds to a real session on the planner.
  if (kind === "stream") {
    const eventId = randomUUID();
    const streamId = await insertStreamSession({
      eventId,
      title: values.title,
      notes: values.description,
      leading: db.insert(events).values({ ...values, id: eventId }),
    });
    revalidatePath("/calendar");
    revalidateStreamPaths(streamId);
    schedulePush(() => pushEventCreated(eventId, values.track));
    return { success: true };
  }

  const [inserted] = await db
    .insert(events)
    .values(values)
    .returning({ id: events.id, track: events.track });
  revalidatePath("/calendar");
  // Push to Google after the response is sent (see docs/google-sync.md) —
  // never delays or can fail this mutation for the user.
  schedulePush(() => pushEventCreated(inserted.id, inserted.track));
  return { success: true };
}

export async function updateEvent(
  id: string,
  _prevState: EventActionState | undefined,
  formData: FormData
): Promise<EventActionState> {
  await verifySession();

  const parsed = parseEventForm(formData);
  if (!parsed.success) {
    return {
      error: VALIDATION_ERROR,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const db = getDb();
  const { kind, ...values } = parsed.data;

  // A track flip breaks any composite FK a child row holds against
  // `events (id, track)` (idea links + streams are content-pinned, meeting
  // notes are work-pinned) — Postgres would raise a raw constraint violation.
  // Catch each here first for a friendly, UI-facing "unlink first" message.
  // Content-pinned children (ideas, streams) can only exist on a content
  // event, and work-pinned children (meeting notes) only on a work event, so
  // the target track alone tells us which to guard (issue #67, finding C8).
  if (values.track === "work") {
    const [ideaLink] = await db
      .select({ ideaId: ideaEventLinks.ideaId })
      .from(ideaEventLinks)
      .where(eq(ideaEventLinks.eventId, id));
    if (ideaLink) {
      return {
        error: "Unlink content first — this event still has linked ideas.",
      };
    }
    const [stream] = await db
      .select({ id: streams.id })
      .from(streams)
      .where(eq(streams.eventId, id));
    if (stream) {
      return {
        error: "Unlink the stream first — this event is still scheduling one.",
      };
    }
  }

  if (values.track === "content") {
    const [meetingNote] = await db
      .select({ id: meetingNotes.id })
      .from(meetingNotes)
      .where(eq(meetingNotes.eventId, id));
    if (meetingNote) {
      return {
        error:
          "Unlink the meeting note first — this event is still attached to one.",
      };
    }
  }

  // Both content-track kinds store the same `track`, so the *kind* change is
  // the one the `events` UPDATE can't express — it's a stream link being
  // added or dropped (issue #104).
  const [session] = await db
    .select({ id: streams.id })
    .from(streams)
    .where(eq(streams.eventId, id));

  const updated = await db
    .update(events)
    .set(values)
    .where(eq(events.id, id))
    .returning({ id: events.id, track: events.track });

  if (updated.length === 0) {
    return { error: "That event no longer exists." };
  }

  let touchedStreamId = session?.id;
  if (kind === "stream" && !session) {
    // Promoting an existing content event to a Stream block.
    touchedStreamId = await insertStreamSession({
      eventId: id,
      title: values.title,
    });
  } else if (kind === "content" && session) {
    // Demoting: the session survives as Unscheduled, checklist and notes
    // intact — never silently destroyed (issue #104). Flipping the same event
    // all the way to Work is refused above instead, since a work-track event
    // can't legally carry the content-pinned link at all.
    await db
      .update(streams)
      .set({ eventId: null, eventTrack: null })
      .where(eq(streams.id, session.id));
  }

  revalidatePath("/calendar");
  if (touchedStreamId) revalidateStreamPaths(touchedStreamId);
  schedulePush(() => pushEventUpdated(updated[0].id, updated[0].track));
  return { success: true };
}

export interface RescheduleEventResult {
  error?: string;
}

/**
 * Narrow mutation for drag-to-reschedule/resize (issue #13): only rewrites
 * `startsAt`/`endsAt`, unlike `updateEvent` which validates the full
 * form-shaped editor payload. Same push-after-commit contract as the other
 * mutations, so Google sync propagation (#12) falls out of reusing this path.
 */
export async function rescheduleEvent(
  id: string,
  startsAt: Date,
  endsAt: Date
): Promise<RescheduleEventResult> {
  await verifySession();

  const parsed = rescheduleSchema.safeParse({ id, startsAt, endsAt });
  if (!parsed.success) {
    return { error: "That reschedule isn't valid." };
  }

  const db = getDb();
  const updated = await db
    .update(events)
    .set({ startsAt: parsed.data.startsAt, endsAt: parsed.data.endsAt })
    .where(eq(events.id, parsed.data.id))
    .returning({ id: events.id, track: events.track });

  if (updated.length === 0) {
    return { error: "That event no longer exists." };
  }

  revalidatePath("/calendar");
  schedulePush(() => pushEventUpdated(updated[0].id, updated[0].track));
  return {};
}

export interface DeleteEventResult {
  error?: string;
}

export async function deleteEvent(id: string): Promise<DeleteEventResult> {
  await verifySession();

  const db = getDb();
  // Both captured before the delete: the sync link's `eventId` and the
  // stream's `eventId`/`eventTrack` auto-null via `ON DELETE SET NULL` the
  // moment the event row is gone (lib/db/schema.ts) — `after()` runs
  // strictly after that (see lib/sync/push.ts), and the stream lookup is
  // what lets this revalidate the stream planner (issue #19), which has no
  // other way to learn its linked event just vanished.
  const [link] = await db
    .select()
    .from(eventSyncLinks)
    .where(eq(eventSyncLinks.eventId, id));
  const [stream] = await db
    .select({ id: streams.id })
    .from(streams)
    .where(eq(streams.eventId, id));

  const deleted = await db
    .delete(events)
    .where(eq(events.id, id))
    .returning({ id: events.id, track: events.track });

  if (deleted.length === 0) {
    return { error: "That event no longer exists." };
  }

  revalidatePath("/calendar");
  if (stream) {
    revalidatePath("/content/streams");
    revalidatePath(`/content/streams/${stream.id}`);
  }
  if (link) {
    schedulePush(() =>
      pushEventDeleted(link.id, link.googleEventId, deleted[0].track)
    );
  }
  return {};
}
