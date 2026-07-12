"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ideas, projects } from "@/lib/db/schema";
import {
  searchLinkableIdeas as searchLinkableIdeasQuery,
  type LinkableIdea,
} from "@/lib/data/projects";

import {
  projectCaptureSchema,
  projectDetailsSchema,
  projectIdeaLinkSchema,
  projectNotesSchema,
  projectStatusSchema,
} from "./project-schema";

export interface ProjectActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  projectId?: string;
}

const VALIDATION_ERROR = "Check the highlighted fields.";

function revalidateProjectPaths(id?: string): void {
  revalidatePath("/projects");
  if (id) revalidatePath(`/projects/${id}`);
}

/** Creates a project. Name is the only required field — description and everything else can wait (see docs/projects.md). */
export async function createProject(
  _prevState: ProjectActionState | undefined,
  formData: FormData
): Promise<ProjectActionState> {
  await verifySession();

  const parsed = projectCaptureSchema.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return {
      error: VALIDATION_ERROR,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const db = getDb();
  const id = randomUUID();
  await db.insert(projects).values({
    id,
    name: parsed.data.name,
    description: parsed.data.description,
  });

  revalidateProjectPaths(id);
  return { success: true, projectId: id };
}

/** Name + description are the only fields editable here — status and notes have their own single-purpose actions below. */
export async function updateProjectDetails(
  _prevState: ProjectActionState | undefined,
  formData: FormData
): Promise<ProjectActionState> {
  await verifySession();

  const parsed = projectDetailsSchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return {
      error: VALIDATION_ERROR,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const db = getDb();
  const description =
    parsed.data.description && parsed.data.description.length > 0
      ? parsed.data.description
      : null;
  const updated = await db
    .update(projects)
    .set({ name: parsed.data.name, description })
    .where(eq(projects.id, parsed.data.id))
    .returning({ id: projects.id });

  if (updated.length === 0) {
    return { error: "That project no longer exists." };
  }

  revalidateProjectPaths(parsed.data.id);
  return { success: true, projectId: parsed.data.id };
}

export interface ProjectMutationResult {
  error?: string;
}

/**
 * A plain status change, no confirmation — cheap to change back (same
 * precedent as `updateIdeaStatus`, see docs/content-ideas.md).
 */
export async function updateProjectStatus(
  id: string,
  status: string
): Promise<ProjectMutationResult> {
  await verifySession();

  const parsed = projectStatusSchema.safeParse({ id, status });
  if (!parsed.success) {
    return { error: "That status isn't valid." };
  }

  const db = getDb();
  const updated = await db
    .update(projects)
    .set({ status: parsed.data.status })
    .where(eq(projects.id, parsed.data.id))
    .returning({ id: projects.id });

  if (updated.length === 0) {
    return { error: "That project no longer exists." };
  }

  revalidateProjectPaths(parsed.data.id);
  return {};
}

export async function saveProjectNotes(
  id: string,
  notes: string
): Promise<ProjectMutationResult> {
  await verifySession();

  const parsed = projectNotesSchema.safeParse({ id, notes });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Those notes couldn't be saved.",
    };
  }

  const db = getDb();
  const updated = await db
    .update(projects)
    .set({ notes: parsed.data.notes })
    .where(eq(projects.id, parsed.data.id))
    .returning({ id: projects.id });

  if (updated.length === 0) {
    return { error: "That project no longer exists." };
  }

  revalidateProjectPaths(parsed.data.id);
  return {};
}

/**
 * Archive, not delete — there is no delete action for projects at all (see
 * the issue's acceptance criteria). Linked ideas keep their `projectId`
 * reference; archived projects are just excluded from the default list and
 * the idea-attach flow.
 */
export async function archiveProject(
  id: string
): Promise<ProjectMutationResult> {
  await verifySession();

  const db = getDb();
  const updated = await db
    .update(projects)
    .set({ archivedAt: new Date() })
    .where(eq(projects.id, id))
    .returning({ id: projects.id });

  if (updated.length === 0) {
    return { error: "That project no longer exists." };
  }

  revalidateProjectPaths(id);
  return {};
}

export async function unarchiveProject(
  id: string
): Promise<ProjectMutationResult> {
  await verifySession();

  const db = getDb();
  const updated = await db
    .update(projects)
    .set({ archivedAt: null })
    .where(eq(projects.id, id))
    .returning({ id: projects.id });

  if (updated.length === 0) {
    return { error: "That project no longer exists." };
  }

  revalidateProjectPaths(id);
  return {};
}

export interface LinkIdeaResult {
  error?: string;
}

/**
 * Sets `ideas.projectId` — an idea belongs to at most one project, so
 * linking is a plain column assignment, not a join-table insert (unlike
 * idea<->event links, see docs/content-links.md and docs/projects.md).
 */
export async function linkIdeaToProject(
  projectId: string,
  ideaId: string
): Promise<LinkIdeaResult> {
  await verifySession();

  const parsed = projectIdeaLinkSchema.safeParse({ projectId, ideaId });
  if (!parsed.success) {
    return { error: "That link isn't valid." };
  }

  const db = getDb();
  const [project] = await db
    .select({ id: projects.id, archivedAt: projects.archivedAt })
    .from(projects)
    .where(eq(projects.id, parsed.data.projectId));
  if (!project) {
    return { error: "That project no longer exists." };
  }
  if (project.archivedAt) {
    return { error: "Archived projects can't take new links." };
  }

  const updated = await db
    .update(ideas)
    .set({ projectId: parsed.data.projectId })
    .where(eq(ideas.id, parsed.data.ideaId))
    .returning({ id: ideas.id });
  if (updated.length === 0) {
    return { error: "That idea no longer exists." };
  }

  revalidateProjectPaths(parsed.data.projectId);
  revalidatePath("/content/ideas");
  revalidatePath("/content/board");
  return {};
}

/** Clears `ideas.projectId`, but only if it still points at this project — a no-op (not an error) if the link was already removed from elsewhere. */
export async function unlinkIdeaFromProject(
  projectId: string,
  ideaId: string
): Promise<LinkIdeaResult> {
  await verifySession();

  const parsed = projectIdeaLinkSchema.safeParse({ projectId, ideaId });
  if (!parsed.success) {
    return { error: "That link isn't valid." };
  }

  const db = getDb();
  await db
    .update(ideas)
    .set({ projectId: null })
    .where(
      and(
        eq(ideas.id, parsed.data.ideaId),
        eq(ideas.projectId, parsed.data.projectId)
      )
    );

  revalidateProjectPaths(parsed.data.projectId);
  revalidatePath("/content/ideas");
  revalidatePath("/content/board");
  return {};
}

/**
 * Backs the idea-attach picker: a direct client -> server-action call (same
 * pattern as `searchAttachableEvents` in `lib/content/stream-actions.ts`),
 * since `lib/data/projects.ts` is `server-only` and can't be imported into a
 * Client Component.
 */
export async function searchLinkableIdeas(
  query: string
): Promise<LinkableIdea[]> {
  await verifySession();
  return searchLinkableIdeasQuery(query);
}
