"use server";

import { verifySession } from "@/lib/auth/session";

import {
  createIdeaCore,
  deleteIdeaCore,
  rescheduleIdeaReleaseCore,
  updateIdeaCore,
  updateIdeaStatusCore,
  type DeleteIdeaResult,
  type IdeaActionState,
  type RescheduleIdeaReleaseResult,
  type UpdateIdeaStatusResult,
} from "./core/ideas";

/**
 * The idea server actions: a session check, FormData unpacking, and a call
 * into `lib/content/core/ideas.ts`, where all the domain logic lives. The
 * split exists so the MCP server (issue #109) can drive exactly the same
 * writes without a session cookie — see docs/mcp.md.
 */

/**
 * NOTE: a `"use server"` module must not re-export its types. Next's Server
 * Actions transform turns every export into a runtime action reference, and a
 * type-only re-export becomes a `ReferenceError` at module evaluation. Callers
 * that need these shapes import them from the core module directly (a plain
 * `import type`, fully erased, so `server-only` never reaches the client).
 */

/** Reads a text field off a form, treating a missing value (or a File) as empty. */
function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createIdea(
  _prevState: IdeaActionState | undefined,
  formData: FormData
): Promise<IdeaActionState> {
  await verifySession();

  return createIdeaCore({
    title: text(formData, "title"),
    description: text(formData, "description"),
    format: text(formData, "format") || undefined,
    tags: text(formData, "tags"),
    gameId: text(formData, "gameId"),
    script: text(formData, "script"),
    releaseDate: text(formData, "releaseDate"),
    releaseTime: text(formData, "releaseTime"),
  });
}

export async function updateIdea(
  id: string,
  _prevState: IdeaActionState | undefined,
  formData: FormData
): Promise<IdeaActionState> {
  await verifySession();

  return updateIdeaCore(id, {
    title: text(formData, "title"),
    description: text(formData, "description"),
    format: text(formData, "format") || undefined,
    tags: text(formData, "tags"),
    gameId: text(formData, "gameId"),
    releaseDate: text(formData, "releaseDate"),
    releaseTime: text(formData, "releaseTime"),
  });
}

export async function rescheduleIdeaRelease(
  ideaId: string,
  releaseDate: string,
  releaseTime: string
): Promise<RescheduleIdeaReleaseResult> {
  await verifySession();
  return rescheduleIdeaReleaseCore(ideaId, releaseDate, releaseTime);
}

export async function updateIdeaStatus(
  id: string,
  status: string
): Promise<UpdateIdeaStatusResult> {
  await verifySession();
  return updateIdeaStatusCore(id, status);
}

export async function deleteIdea(id: string): Promise<DeleteIdeaResult> {
  await verifySession();
  return deleteIdeaCore(id);
}
