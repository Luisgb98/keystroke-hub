import "server-only";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { events, ideaEventLinks, ideas } from "@/lib/db/schema";

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
 * bypassed. That check is also what keeps the work world unreachable through
 * MCP (issue #109).
 */
export async function linkIdeaToEventCore(
  eventId: string,
  ideaId: string
): Promise<LinkActionResult> {
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
export async function unlinkIdeaFromEventCore(
  eventId: string,
  ideaId: string
): Promise<LinkActionResult> {
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
