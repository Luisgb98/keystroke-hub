"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  ideaChecklistItems,
  ideas,
  type IdeaChecklistItem,
} from "@/lib/db/schema";
import { getIdeaChecklistItems as getIdeaChecklistItemsQuery } from "@/lib/data/idea-checklists";

import { checklistLabelSchema } from "./checklist-schema";

function revalidateBoardPaths(): void {
  revalidatePath("/content/board");
  revalidatePath("/content/ideas");
}

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

export interface ChecklistItemResult {
  error?: string;
}

/** Idempotent — toggling to the same value twice is a no-op success (mirrors the stream checklist's `toggleChecklistItem`). */
export async function toggleIdeaChecklistItem(
  ideaId: string,
  itemId: string,
  done: boolean
): Promise<ChecklistItemResult> {
  await verifySession();

  const db = getDb();
  const updated = await db
    .update(ideaChecklistItems)
    .set({ done })
    .where(
      and(
        eq(ideaChecklistItems.id, itemId),
        eq(ideaChecklistItems.ideaId, ideaId)
      )
    )
    .returning({ id: ideaChecklistItems.id });

  if (updated.length === 0) {
    return { error: "That checklist item no longer exists." };
  }

  revalidateBoardPaths();
  return {};
}

async function nextPosition(
  positions: { position: number }[]
): Promise<number> {
  return positions.reduce((max, row) => Math.max(max, row.position), -1) + 1;
}

/** Appends a per-idea checklist item — local to this idea, satisfies "editable per video" (see docs/content-ideas.md). */
export async function addIdeaChecklistItem(
  ideaId: string,
  label: string
): Promise<ChecklistItemResult> {
  await verifySession();

  const parsedLabel = checklistLabelSchema.safeParse(label);
  if (!parsedLabel.success) {
    return {
      error: parsedLabel.error.issues[0]?.message ?? "That item isn't valid.",
    };
  }

  const db = getDb();
  const [idea] = await db
    .select({ id: ideas.id })
    .from(ideas)
    .where(eq(ideas.id, ideaId));
  if (!idea) {
    return { error: "That idea no longer exists." };
  }

  const existing = await db
    .select({ position: ideaChecklistItems.position })
    .from(ideaChecklistItems)
    .where(eq(ideaChecklistItems.ideaId, ideaId));

  await db.insert(ideaChecklistItems).values({
    ideaId,
    label: parsedLabel.data,
    position: await nextPosition(existing),
  });

  revalidateBoardPaths();
  return {};
}

export async function removeIdeaChecklistItem(
  ideaId: string,
  itemId: string
): Promise<ChecklistItemResult> {
  await verifySession();

  const db = getDb();
  await db
    .delete(ideaChecklistItems)
    .where(
      and(
        eq(ideaChecklistItems.id, itemId),
        eq(ideaChecklistItems.ideaId, ideaId)
      )
    );

  revalidateBoardPaths();
  return {};
}
