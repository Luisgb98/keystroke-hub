"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ideas } from "@/lib/db/schema";

import { ideaCaptureSchema, ideaStatusSchema } from "./idea-schema";

export interface IdeaActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

const VALIDATION_ERROR = "Check the highlighted fields.";

/**
 * Capture a new idea. Title is the only required field — everything else
 * defaults (format to "either", status to the initial pipeline stage) so
 * capture stays a two-tap, few-second action (see docs/content-ideas.md).
 */
export async function createIdea(
  _prevState: IdeaActionState | undefined,
  formData: FormData
): Promise<IdeaActionState> {
  await verifySession();

  const parsed = ideaCaptureSchema.safeParse({
    title: formData.get("title") ?? "",
    notes: formData.get("notes") ?? "",
    format: formData.get("format") || undefined,
    tags: formData.get("tags") ?? "",
  });
  if (!parsed.success) {
    return {
      error: VALIDATION_ERROR,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const db = getDb();
  await db.insert(ideas).values(parsed.data);
  revalidatePath("/content/ideas");
  return { success: true };
}

export interface UpdateIdeaStatusResult {
  error?: string;
}

/**
 * Shared by `IdeaCard`'s inline status `<select>` and #16's board move menu —
 * both surfaces call this one mutation, so behavior (including the stage
 * clock below) stays consistent between them. Mirrors `rescheduleEvent`'s
 * narrow-mutation shape in `lib/calendar/actions.ts`.
 *
 * `stageEnteredAt` resets to `now()` only when the status actually changes —
 * re-submitting the current status (e.g. re-selecting it, or a stale
 * optimistic retry) must not reset the board's time-in-stage clock (see
 * docs/content-ideas.md).
 */
export async function updateIdeaStatus(
  id: string,
  status: string
): Promise<UpdateIdeaStatusResult> {
  await verifySession();

  const parsed = ideaStatusSchema.safeParse({ id, status });
  if (!parsed.success) {
    return { error: "That status isn't valid." };
  }

  const db = getDb();
  const updated = await db
    .update(ideas)
    .set({
      status: parsed.data.status,
      stageEnteredAt: sql`case when ${ideas.status} is distinct from ${parsed.data.status} then now() else ${ideas.stageEnteredAt} end`,
    })
    .where(eq(ideas.id, parsed.data.id))
    .returning({ id: ideas.id });

  if (updated.length === 0) {
    return { error: "That idea no longer exists." };
  }

  revalidatePath("/content/ideas");
  revalidatePath("/content/board");
  return {};
}

export interface DeleteIdeaResult {
  error?: string;
}

/** Hard delete, no soft-archive — matches #11's event delete precedent (see docs/content-ideas.md open question 5). */
export async function deleteIdea(id: string): Promise<DeleteIdeaResult> {
  await verifySession();

  const db = getDb();
  const deleted = await db
    .delete(ideas)
    .where(eq(ideas.id, id))
    .returning({ id: ideas.id });

  if (deleted.length === 0) {
    return { error: "That idea no longer exists." };
  }

  revalidatePath("/content/ideas");
  return {};
}
