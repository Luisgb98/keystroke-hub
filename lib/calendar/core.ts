import "server-only";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
import {
  SINGLE_DAY_MESSAGE,
  isSingleAppDay,
  isSingleDayKind,
} from "./single-day";
import { trackKindOf } from "./track-kind";

/**
 * The calendar-event domain, free of any transport. `lib/calendar/actions.ts`
 * adds the session gate for the UI; `lib/mcp/tools/events.ts` calls the same
 * functions for content-track events only (issue #109, see docs/mcp.md).
 */

export interface EventActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  /** Set on a successful create — MCP clients need the id to keep working on it. */
  eventId?: string;
}

export const VALIDATION_ERROR = "Check the highlighted fields.";

/** Form-shaped event input, exactly the fields the event editor submits. */
export interface RawEventInput {
  title?: string;
  /** A `TrackKind`: "work", "content" or "stream" (see ./track-kind.ts). */
  track?: string;
  description?: string;
  allDay?: boolean;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
}

function parseEventInput(raw: RawEventInput) {
  return eventFormSchema.safeParse({
    title: raw.title ?? "",
    track: raw.track || undefined,
    description: raw.description ?? "",
    allDay: raw.allDay ?? false,
    startDate: raw.startDate ?? "",
    startTime: raw.startTime || undefined,
    endDate: raw.endDate ?? "",
    endTime: raw.endTime || undefined,
  });
}

/** Both stream-planner routes, refreshed whenever a calendar write moves a session. */
function revalidateStreamPaths(streamId?: string): void {
  revalidatePath("/content/streams");
  if (streamId) revalidatePath(`/content/streams/${streamId}`);
}

export async function createEventCore(
  raw: RawEventInput
): Promise<EventActionState> {
  const parsed = parseEventInput(raw);
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
    return { success: true, eventId };
  }

  const [inserted] = await db
    .insert(events)
    .values(values)
    .returning({ id: events.id, track: events.track });
  revalidatePath("/calendar");
  // Push to Google after the response is sent (see docs/google-sync.md) —
  // never delays or can fail this mutation for the user.
  schedulePush(() => pushEventCreated(inserted.id, inserted.track));
  return { success: true, eventId: inserted.id };
}

export async function updateEventCore(
  id: string,
  raw: RawEventInput
): Promise<EventActionState> {
  const parsed = parseEventInput(raw);
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
 * `startsAt`/`endsAt`, unlike `updateEventCore` which validates the full
 * form-shaped editor payload. Same push-after-commit contract as the other
 * mutations, so Google sync propagation (#12) falls out of reusing this path.
 */
export async function rescheduleEventCore(
  id: string,
  startsAt: Date,
  endsAt: Date
): Promise<RescheduleEventResult> {
  const parsed = rescheduleSchema.safeParse({ id, startsAt, endsAt });
  if (!parsed.success) {
    return { error: "That reschedule isn't valid." };
  }

  const db = getDb();

  // The single-day rule has to hold on the drag/resize path too (#115), and
  // this is the only place all of them meet: the calendar's own reschedule,
  // Undo, and the MCP tool. Read the kind first — a reschedule carries only
  // bounds, so the row is the only thing that knows whether it's content.
  //
  // It refuses rather than clamping. The calendar clamps in the gesture
  // (`clampToStartDay`, see `./single-day.ts`), so anything still arriving
  // multi-day here is a caller that ignored the rule, and silently rewriting
  // its request would hide that.
  const [existing] = await db
    .select({ track: events.track, streamId: streams.id })
    .from(events)
    .leftJoin(streams, eq(streams.eventId, events.id))
    .where(eq(events.id, parsed.data.id));

  if (
    existing &&
    isSingleDayKind(trackKindOf(existing)) &&
    !isSingleAppDay(parsed.data.startsAt, parsed.data.endsAt)
  ) {
    return { error: SINGLE_DAY_MESSAGE };
  }

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

export async function deleteEventCore(id: string): Promise<DeleteEventResult> {
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
