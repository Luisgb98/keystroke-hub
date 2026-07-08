"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ideas, scripts } from "@/lib/db/schema";

import { scriptSaveSchema } from "./script-schema";

export interface SaveScriptResult {
  error?: string;
  updatedAt?: Date;
}

/**
 * Upsert keyed on `idea_id` — a script attaches to exactly one idea, and the
 * first save is what creates its row; every save after that is an update. No
 * separate "create script" step (see docs/scripts.md).
 */
export async function saveScript(
  ideaId: string,
  content: string
): Promise<SaveScriptResult> {
  await verifySession();

  const parsed = scriptSaveSchema.safeParse({ ideaId, content });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "That script couldn't be saved.",
    };
  }

  const db = getDb();

  // Client sends only the id, per the server-actions data-security guide —
  // the idea itself is re-read here rather than trusted from the caller, and
  // a stale/unknown id fails cleanly instead of tripping the FK constraint.
  const [idea] = await db
    .select({ id: ideas.id })
    .from(ideas)
    .where(eq(ideas.id, parsed.data.ideaId));
  if (!idea) {
    return { error: "That idea no longer exists." };
  }

  const now = new Date();
  const [saved] = await db
    .insert(scripts)
    .values({ ideaId: parsed.data.ideaId, content: parsed.data.content })
    .onConflictDoUpdate({
      target: scripts.ideaId,
      set: { content: parsed.data.content, updatedAt: now },
    })
    .returning({ updatedAt: scripts.updatedAt });

  revalidatePath(`/content/ideas/${parsed.data.ideaId}/script`);
  revalidatePath("/content/ideas");
  revalidatePath("/content/board");

  return { updatedAt: saved.updatedAt };
}
