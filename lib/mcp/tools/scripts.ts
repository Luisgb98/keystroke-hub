import "server-only";

import { z } from "zod";

import { saveScriptCore } from "@/lib/content/core/scripts";
import { getIdeaWithScript } from "@/lib/data/scripts";

import { idParam } from "../params";
import {
  defineTool,
  fail,
  fromCoreResult,
  ok,
  type McpToolDefinition,
} from "../tool";

/** Script tools — the Markdown draft behind an idea (see docs/scripts.md). */

const getScript = defineTool(
  "get_script",
  {
    title: "Read an idea's script",
    description:
      "The idea's full Markdown script. Returns `content: null` when nothing has been written yet.",
    inputSchema: z.object({ ideaId: idParam }),
    annotations: { readOnlyHint: true },
  },
  async ({ ideaId }) => {
    const found = await getIdeaWithScript(ideaId);
    if (!found) return fail("That idea no longer exists.");
    return ok({
      ideaId,
      title: found.idea.title,
      content: found.script?.content ?? null,
      updatedAt: found.script?.updatedAt.toISOString() ?? null,
    });
  }
);

const saveScript = defineTool(
  "save_script",
  {
    title: "Save an idea's script",
    description:
      "Replaces the idea's whole script with the Markdown given. This overwrites, it does not append — read `get_script` first if you mean to edit rather than replace.",
    inputSchema: z.object({
      ideaId: idParam,
      content: z.string().describe("The complete Markdown script."),
    }),
  },
  async ({ ideaId, content }) => {
    const result = await saveScriptCore(ideaId, content);
    return fromCoreResult(result, {
      ideaId,
      updatedAt: result.updatedAt?.toISOString() ?? null,
    });
  }
);

export const scriptTools: McpToolDefinition[] = [getScript, saveScript];
