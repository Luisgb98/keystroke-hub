"use server";

import { verifySession } from "@/lib/auth/session";
import {
  searchAttachableEvents as searchAttachableEventsQuery,
  type AttachableEvent,
} from "@/lib/data/streams";

import {
  addChecklistItemCore,
  addTemplateItemCore,
  attachEventToStreamCore,
  createStreamCore,
  deleteStreamCore,
  detachEventFromStreamCore,
  removeChecklistItemCore,
  removeTemplateItemCore,
  toggleChecklistItemCore,
  updateStreamDetailsCore,
  type AttachEventResult,
  type ChecklistItemResult,
  type DeleteStreamResult,
  type StreamActionState,
  type StreamDetailsInput,
  type TemplateItemResult,
} from "./core/streams";

/**
 * Session gates over `lib/content/core/streams.ts` — the domain logic is shared
 * with the MCP stream tools so an MCP-planned session is indistinguishable from
 * a UI-planned one (issue #109, see docs/mcp.md).
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

export async function createStream(
  _prevState: StreamActionState | undefined,
  formData: FormData
): Promise<StreamActionState> {
  await verifySession();

  return createStreamCore({
    title: text(formData, "title"),
    notes: text(formData, "notes"),
    gameId: text(formData, "gameId"),
    planned: text(formData, "planned") === "true",
    allDay: text(formData, "allDay") === "true",
    date: text(formData, "date") || undefined,
    time: text(formData, "time") || undefined,
  });
}

export async function updateStreamDetails(
  input: StreamDetailsInput
): Promise<StreamActionState> {
  await verifySession();
  return updateStreamDetailsCore(input);
}

export async function deleteStream(id: string): Promise<DeleteStreamResult> {
  await verifySession();
  return deleteStreamCore(id);
}

export async function toggleChecklistItem(
  streamId: string,
  itemId: string,
  done: boolean
): Promise<ChecklistItemResult> {
  await verifySession();
  return toggleChecklistItemCore(streamId, itemId, done);
}

export async function addChecklistItem(
  streamId: string,
  label: string
): Promise<ChecklistItemResult> {
  await verifySession();
  return addChecklistItemCore(streamId, label);
}

export async function removeChecklistItem(
  streamId: string,
  itemId: string
): Promise<ChecklistItemResult> {
  await verifySession();
  return removeChecklistItemCore(streamId, itemId);
}

export async function addTemplateItem(
  label: string
): Promise<TemplateItemResult> {
  await verifySession();
  return addTemplateItemCore(label);
}

export async function removeTemplateItem(
  id: string
): Promise<TemplateItemResult> {
  await verifySession();
  return removeTemplateItemCore(id);
}

export async function attachEventToStream(
  streamId: string,
  eventId: string
): Promise<AttachEventResult> {
  await verifySession();
  return attachEventToStreamCore(streamId, eventId);
}

export async function detachEventFromStream(
  streamId: string
): Promise<AttachEventResult> {
  await verifySession();
  return detachEventFromStreamCore(streamId);
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
