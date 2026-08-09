"use server";

import { verifySession } from "@/lib/auth/session";

import { saveScriptCore, type SaveScriptResult } from "./core/scripts";

/**
 * NOTE: a `"use server"` module must not re-export its types. Next's Server
 * Actions transform turns every export into a runtime action reference, and a
 * type-only re-export becomes a `ReferenceError` at module evaluation. Callers
 * that need these shapes import them from the core module directly (a plain
 * `import type`, fully erased, so `server-only` never reaches the client).
 */

/** Session gate over `saveScriptCore` — the domain logic lives in `lib/content/core/scripts.ts` (shared with MCP, see docs/mcp.md). */
export async function saveScript(
  ideaId: string,
  content: string
): Promise<SaveScriptResult> {
  await verifySession();
  return saveScriptCore(ideaId, content);
}
