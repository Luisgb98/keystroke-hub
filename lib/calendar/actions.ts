"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";

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
  await db.insert(events).values(parsed.data);
  revalidatePath("/calendar");
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
    .returning({ id: events.id });

  if (updated.length === 0) {
    return { error: "That event no longer exists." };
  }

  revalidatePath("/calendar");
  return { success: true };
}

export interface DeleteEventResult {
  error?: string;
}

export async function deleteEvent(id: string): Promise<DeleteEventResult> {
  await verifySession();

  const db = getDb();
  const deleted = await db
    .delete(events)
    .where(eq(events.id, id))
    .returning({ id: events.id });

  if (deleted.length === 0) {
    return { error: "That event no longer exists." };
  }

  revalidatePath("/calendar");
  return {};
}
