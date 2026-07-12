"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { improvements, projects } from "@/lib/db/schema";

import {
  improvementCaptureSchema,
  improvementDetailsSchema,
  improvementOutcomeSchema,
  improvementStatusSchema,
} from "./improvement-schema";

export interface ImprovementActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  improvementId?: string;
}

export interface ImprovementMutationResult {
  error?: string;
}

const VALIDATION_ERROR = "Check the highlighted fields.";
const ARCHIVED_PROJECT_ERROR = "Archived projects can't take new links.";

function revalidateImprovementPaths(projectId?: string | null): void {
  revalidatePath("/projects/improvements");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

/**
 * Rejects an unknown or archived project id — same guard as
 * `linkIdeaToProject` (see docs/projects.md). Returns `undefined` when the
 * project id is valid (or absent).
 */
async function checkLinkableProject(
  projectId: string | null
): Promise<string | undefined> {
  if (!projectId) return undefined;

  const db = getDb();
  const [project] = await db
    .select({ id: projects.id, archivedAt: projects.archivedAt })
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) return "That project no longer exists.";
  if (project.archivedAt) return ARCHIVED_PROJECT_ERROR;
  return undefined;
}

/** Creates an improvement. Title is the only required field (see docs/improvements.md). */
export async function createImprovement(
  _prevState: ImprovementActionState | undefined,
  formData: FormData
): Promise<ImprovementActionState> {
  await verifySession();

  const parsed = improvementCaptureSchema.safeParse({
    title: formData.get("title") ?? "",
    rationale: formData.get("rationale") ?? "",
    projectId: formData.get("projectId") ?? "",
  });
  if (!parsed.success) {
    return {
      error: VALIDATION_ERROR,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const projectError = await checkLinkableProject(parsed.data.projectId);
  if (projectError) return { error: projectError };

  const db = getDb();
  const id = randomUUID();
  await db.insert(improvements).values({
    id,
    title: parsed.data.title,
    rationale: parsed.data.rationale,
    projectId: parsed.data.projectId,
  });

  revalidateImprovementPaths(parsed.data.projectId);
  return { success: true, improvementId: id };
}

/**
 * Title, rationale, and the optional project link are the only fields
 * editable here — status and outcome have their own single-purpose actions
 * below.
 */
export async function updateImprovementDetails(
  _prevState: ImprovementActionState | undefined,
  formData: FormData
): Promise<ImprovementActionState> {
  await verifySession();

  const parsed = improvementDetailsSchema.safeParse({
    id: formData.get("id") ?? "",
    title: formData.get("title") ?? "",
    rationale: formData.get("rationale") ?? "",
    projectId: formData.get("projectId") ?? "",
  });
  if (!parsed.success) {
    return {
      error: VALIDATION_ERROR,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const rationale =
    parsed.data.rationale && parsed.data.rationale.length > 0
      ? parsed.data.rationale
      : null;
  const projectId =
    parsed.data.projectId && parsed.data.projectId.length > 0
      ? parsed.data.projectId
      : null;

  const projectError = await checkLinkableProject(projectId);
  if (projectError) return { error: projectError };

  const db = getDb();
  const [existing] = await db
    .select({ projectId: improvements.projectId })
    .from(improvements)
    .where(eq(improvements.id, parsed.data.id));
  if (!existing) {
    return { error: "That improvement no longer exists." };
  }

  await db
    .update(improvements)
    .set({ title: parsed.data.title, rationale, projectId })
    .where(eq(improvements.id, parsed.data.id));

  revalidateImprovementPaths(existing.projectId);
  revalidateImprovementPaths(projectId);
  return { success: true, improvementId: parsed.data.id };
}

/**
 * A plain status change, no confirmation — `accepted`/`rejected` are
 * rejected here since they're only reachable via `recordImprovementOutcome`
 * (see docs/improvements.md).
 */
export async function updateImprovementStatus(
  id: string,
  status: string
): Promise<ImprovementMutationResult> {
  await verifySession();

  const parsed = improvementStatusSchema.safeParse({ id, status });
  if (!parsed.success) {
    return { error: "Record an outcome to accept or reject." };
  }

  const db = getDb();
  const updated = await db
    .update(improvements)
    .set({ status: parsed.data.status })
    .where(eq(improvements.id, parsed.data.id))
    .returning({ id: improvements.id, projectId: improvements.projectId });

  if (updated.length === 0) {
    return { error: "That improvement no longer exists." };
  }

  revalidateImprovementPaths(updated[0].projectId);
  return {};
}

/** Sets `accepted`/`rejected` + the outcome text in one write — the only path onto those two statuses. */
export async function recordImprovementOutcome(
  id: string,
  status: string,
  outcome: string
): Promise<ImprovementMutationResult> {
  await verifySession();

  const parsed = improvementOutcomeSchema.safeParse({ id, status, outcome });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "That outcome couldn't be saved.",
    };
  }

  const db = getDb();
  const updated = await db
    .update(improvements)
    .set({
      status: parsed.data.status,
      outcome: parsed.data.outcome ?? null,
    })
    .where(eq(improvements.id, parsed.data.id))
    .returning({ id: improvements.id, projectId: improvements.projectId });

  if (updated.length === 0) {
    return { error: "That improvement no longer exists." };
  }

  revalidateImprovementPaths(updated[0].projectId);
  return {};
}
