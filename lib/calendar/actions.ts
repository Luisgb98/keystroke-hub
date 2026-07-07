"use server";

import { eq } from "drizzle-orm";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { eventSyncLinks, events } from "@/lib/db/schema";
import {
  pushEventCreated,
  pushEventDeleted,
  pushEventUpdated,
} from "@/lib/sync/push";

import { eventFormSchema } from "./event-schema";

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
  const [inserted] = await db
    .insert(events)
    .values(parsed.data)
    .returning({ id: events.id, track: events.track });
  revalidatePath("/calendar");
  // Push to Google after the response is sent (see docs/google-sync.md) —
  // never delays or can fail this mutation for the user.
  after(() => pushEventCreated(inserted.id, inserted.track));
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
  const updated = await db
    .update(events)
    .set(parsed.data)
    .where(eq(events.id, id))
    .returning({ id: events.id, track: events.track });

  if (updated.length === 0) {
    return { error: "That event no longer exists." };
  }

  revalidatePath("/calendar");
  after(() => pushEventUpdated(updated[0].id, updated[0].track));
  return { success: true };
}

export interface DeleteEventResult {
  error?: string;
}

export async function deleteEvent(id: string): Promise<DeleteEventResult> {
  await verifySession();

  const db = getDb();
  // Captured before the delete: the link's `eventId` auto-nulls via
  // `ON DELETE SET NULL` the moment the event row is gone (lib/db/schema.ts),
  // and `after()` runs strictly after that — see lib/sync/push.ts.
  const [link] = await db
    .select()
    .from(eventSyncLinks)
    .where(eq(eventSyncLinks.eventId, id));

  const deleted = await db
    .delete(events)
    .where(eq(events.id, id))
    .returning({ id: events.id, track: events.track });

  if (deleted.length === 0) {
    return { error: "That event no longer exists." };
  }

  revalidatePath("/calendar");
  if (link) {
    after(() =>
      pushEventDeleted(link.id, link.googleEventId, deleted[0].track)
    );
  }
  return {};
}
