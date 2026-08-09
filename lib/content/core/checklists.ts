import "server-only";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { ideaChecklistItems, ideas } from "@/lib/db/schema";

import { checklistLabelSchema } from "../checklist-schema";

function revalidateBoardPaths(): void {
  revalidatePath("/content/board");
  revalidatePath("/content/ideas");
}

export interface ChecklistItemResult {
  error?: string;
}

/** Idempotent — toggling to the same value twice is a no-op success (mirrors the stream checklist's `toggleChecklistItemCore`). */
export async function toggleIdeaChecklistItemCore(
  ideaId: string,
  itemId: string,
  done: boolean
): Promise<ChecklistItemResult> {
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

/** Highest existing position + 1, or 0 for an empty list. */
export function nextPosition(positions: { position: number }[]): number {
  return positions.reduce((max, row) => Math.max(max, row.position), -1) + 1;
}

/** Appends a per-idea checklist item — local to this idea, satisfies "editable per video" (see docs/content-ideas.md). */
export async function addIdeaChecklistItemCore(
  ideaId: string,
  label: string
): Promise<ChecklistItemResult> {
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
    position: nextPosition(existing),
  });

  revalidateBoardPaths();
  return {};
}

export async function removeIdeaChecklistItemCore(
  ideaId: string,
  itemId: string
): Promise<ChecklistItemResult> {
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
