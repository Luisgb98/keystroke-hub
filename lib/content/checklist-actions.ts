"use server";

import { verifySession } from "@/lib/auth/session";
import { type IdeaChecklistItem } from "@/lib/db/schema";
import { getIdeaChecklistItems as getIdeaChecklistItemsQuery } from "@/lib/data/idea-checklists";

import {
  addIdeaChecklistItemCore,
  removeIdeaChecklistItemCore,
  toggleIdeaChecklistItemCore,
  type ChecklistItemResult,
} from "./core/checklists";

/** Session gates over `lib/content/core/checklists.ts`, shared with the MCP publish-checklist tools (see docs/mcp.md). */

/**
 * NOTE: a `"use server"` module must not re-export its types. Next's Server
 * Actions transform turns every export into a runtime action reference, and a
 * type-only re-export becomes a `ReferenceError` at module evaluation. Callers
 * that need these shapes import them from the core module directly (a plain
 * `import type`, fully erased, so `server-only` never reaches the client).
 */

/**
 * Client-facing wrapper around the `server-only` data-layer query — backs
 * `PublishChecklistDialog`'s on-open fetch, same pattern as
 * `searchAttachableEvents` in `lib/content/stream-actions.ts`.
 */
export async function getIdeaChecklistItems(
  ideaId: string
): Promise<IdeaChecklistItem[]> {
  await verifySession();
  return getIdeaChecklistItemsQuery(ideaId);
}

export async function toggleIdeaChecklistItem(
  ideaId: string,
  itemId: string,
  done: boolean
): Promise<ChecklistItemResult> {
  await verifySession();
  return toggleIdeaChecklistItemCore(ideaId, itemId, done);
}

export async function addIdeaChecklistItem(
  ideaId: string,
  label: string
): Promise<ChecklistItemResult> {
  await verifySession();
  return addIdeaChecklistItemCore(ideaId, label);
}

export async function removeIdeaChecklistItem(
  ideaId: string,
  itemId: string
): Promise<ChecklistItemResult> {
  await verifySession();
  return removeIdeaChecklistItemCore(ideaId, itemId);
}
