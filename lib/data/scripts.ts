import "server-only";
import { eq, ne } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { ideas, scripts, type Idea, type Script } from "@/lib/db/schema";

export interface IdeaWithScript {
  idea: Idea;
  script: Script | null;
}

/**
 * The script page's one query: the idea (so the page can 404 for an unknown
 * id) plus its script, if one has ever been saved (see docs/scripts.md).
 */
export async function getIdeaWithScript(
  ideaId: string
): Promise<IdeaWithScript | null> {
  const db = getDb();
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId));
  if (!idea) return null;

  const [script] = await db
    .select()
    .from(scripts)
    .where(eq(scripts.ideaId, ideaId));

  return { idea, script: script ?? null };
}

/**
 * Ideas with a non-empty saved script — feeds the "has script" indicator on
 * `IdeaCard` and `BoardCard`. Empty-string scripts (a row that exists only
 * because of a since-cleared draft) don't count as "has a script".
 */
export async function getIdeaIdsWithScripts(): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ ideaId: scripts.ideaId })
    .from(scripts)
    .where(ne(scripts.content, ""));
  return new Set(rows.map((row) => row.ideaId));
}
