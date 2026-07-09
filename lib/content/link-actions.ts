"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { events, ideaEventLinks, ideas } from "@/lib/db/schema";
import {
  searchLinkableIdeas as searchLinkableIdeasQuery,
  type LinkableIdea,
} from "@/lib/data/idea-event-links";

const linkSchema = z.object({
  eventId: z.string().min(1),
  ideaId: z.string().min(1),
});

export interface LinkActionResult {
  error?: string;
}

function revalidateLinkedPaths(): void {
  revalidatePath("/calendar");
  revalidatePath("/content/ideas");
}

/**
 * Attaches an idea to a content-track event. The content-track-only rule is
 * enforced here first (a typed, UI-facing error) and again at the DB level
 * by the composite FK on `idea_event_links` (see docs/content-links.md) — no
 * code path can create a work-track link even if this check is ever
 * bypassed.
 */
export async function linkIdeaToEvent(
  eventId: string,
  ideaId: string
): Promise<LinkActionResult> {
  await verifySession();

  const parsed = linkSchema.safeParse({ eventId, ideaId });
  if (!parsed.success) {
    return { error: "That link isn't valid." };
  }

  const db = getDb();
  const [event] = await db
    .select({ id: events.id, track: events.track })
    .from(events)
    .where(eq(events.id, parsed.data.eventId));
  if (!event) {
    return { error: "That event no longer exists." };
  }
  if (event.track !== "content") {
    return { error: "Only content-track events can link to ideas." };
  }

  const [idea] = await db
    .select({ id: ideas.id })
    .from(ideas)
    .where(eq(ideas.id, parsed.data.ideaId));
  if (!idea) {
    return { error: "That idea no longer exists." };
  }

  // A PK conflict means the link already exists — treated as an idempotent
  // success rather than an error (see docs/content-links.md).
  await db
    .insert(ideaEventLinks)
    .values({
      ideaId: parsed.data.ideaId,
      eventId: parsed.data.eventId,
      eventTrack: "content",
    })
    .onConflictDoNothing({
      target: [ideaEventLinks.ideaId, ideaEventLinks.eventId],
    });

  revalidateLinkedPaths();
  return {};
}

/** Removing a link that no longer exists is a no-op, not an error — the row may have already been cleared from the other side. */
export async function unlinkIdeaFromEvent(
  eventId: string,
  ideaId: string
): Promise<LinkActionResult> {
  await verifySession();

  const parsed = linkSchema.safeParse({ eventId, ideaId });
  if (!parsed.success) {
    return { error: "That link isn't valid." };
  }

  const db = getDb();
  await db
    .delete(ideaEventLinks)
    .where(
      and(
        eq(ideaEventLinks.eventId, parsed.data.eventId),
        eq(ideaEventLinks.ideaId, parsed.data.ideaId)
      )
    );

  revalidateLinkedPaths();
  return {};
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
