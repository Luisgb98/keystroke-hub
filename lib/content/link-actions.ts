"use server";

import { verifySession } from "@/lib/auth/session";
import {
  searchLinkableIdeas as searchLinkableIdeasQuery,
  type LinkableIdea,
} from "@/lib/data/idea-event-links";

import {
  linkIdeaToEventCore,
  unlinkIdeaFromEventCore,
  type LinkActionResult,
} from "./core/links";

/** Session gates over `lib/content/core/links.ts`, shared with the MCP link tools (see docs/mcp.md). */

/**
 * NOTE: a `"use server"` module must not re-export its types. Next's Server
 * Actions transform turns every export into a runtime action reference, and a
 * type-only re-export becomes a `ReferenceError` at module evaluation. Callers
 * that need these shapes import them from the core module directly (a plain
 * `import type`, fully erased, so `server-only` never reaches the client).
 */

export async function linkIdeaToEvent(
  eventId: string,
  ideaId: string
): Promise<LinkActionResult> {
  await verifySession();
  return linkIdeaToEventCore(eventId, ideaId);
}

export async function unlinkIdeaFromEvent(
  eventId: string,
  ideaId: string
): Promise<LinkActionResult> {
  await verifySession();
  return unlinkIdeaFromEventCore(eventId, ideaId);
}

/**
 * Backs the idea-link picker: a direct client -> server-action call (same
 * pattern as `updateIdeaStatus`), since `lib/data/idea-event-links.ts` is
 * `server-only` and can't be imported into the picker's Client Component.
 */
export async function searchLinkableIdeas(
  eventId: string,
  query: string
): Promise<LinkableIdea[]> {
  await verifySession();
  return searchLinkableIdeasQuery(eventId, query);
}
