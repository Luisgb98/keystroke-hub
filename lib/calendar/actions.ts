"use server";

import { verifySession } from "@/lib/auth/session";

import {
  createEventCore,
  deleteEventCore,
  rescheduleEventCore,
  updateEventCore,
  type DeleteEventResult,
  type EventActionState,
  type RescheduleEventResult,
} from "./core";

/**
 * Session gates over `lib/calendar/core.ts`, whose domain logic the MCP
 * content-event tools share (issue #109, see docs/mcp.md).
 */

/**
 * NOTE: a `"use server"` module must not re-export its types. Next's Server
 * Actions transform turns every export into a runtime action reference, and a
 * type-only re-export becomes a `ReferenceError` at module evaluation. Callers
 * that need these shapes import them from the core module directly (a plain
 * `import type`, fully erased, so `server-only` never reaches the client).
 */

/** Reads a text field off a form, treating a missing value (or a File) as empty. */
function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function parseEventForm(formData: FormData) {
  return {
    title: text(formData, "title"),
    track: text(formData, "track") || undefined,
    description: text(formData, "description"),
    allDay: text(formData, "allDay") === "true",
    startDate: text(formData, "startDate"),
    startTime: text(formData, "startTime") || undefined,
    endDate: text(formData, "endDate"),
    endTime: text(formData, "endTime") || undefined,
  };
}

export async function createEvent(
  _prevState: EventActionState | undefined,
  formData: FormData
): Promise<EventActionState> {
  await verifySession();
  return createEventCore(parseEventForm(formData));
}

export async function updateEvent(
  id: string,
  _prevState: EventActionState | undefined,
  formData: FormData
): Promise<EventActionState> {
  await verifySession();
  return updateEventCore(id, parseEventForm(formData));
}

export async function rescheduleEvent(
  id: string,
  startsAt: Date,
  endsAt: Date
): Promise<RescheduleEventResult> {
  await verifySession();
  return rescheduleEventCore(id, startsAt, endsAt);
}

export async function deleteEvent(id: string): Promise<DeleteEventResult> {
  await verifySession();
  return deleteEventCore(id);
}
