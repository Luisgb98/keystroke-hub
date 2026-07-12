import { z } from "zod";

import { isProjectStatus } from "./project-status";

/** The final, DB-ready shape produced by `projectCaptureSchema` on success. */
export interface ProjectInput {
  name: string;
  description: string | null;
}

const rawProjectCaptureSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(200, "Keep the name under 200 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Keep the description under 2000 characters")
    .optional(),
});

/** Shared by the capture form and `createProject`. No unique-name constraint — a single-user app values renaming freedom over collision errors (see docs/projects.md). */
export const projectCaptureSchema = rawProjectCaptureSchema.transform(
  (data): ProjectInput => ({
    name: data.name,
    description:
      data.description && data.description.length > 0 ? data.description : null,
  })
);

/** Shared by `updateProjectDetails`: name/description are the only fields editable here — status and notes have their own actions. */
export const projectDetailsSchema = z.object({
  id: z.string().min(1),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(200, "Keep the name under 200 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Keep the description under 2000 characters")
    .optional(),
});

/** Shared by `updateProjectStatus`. */
export const projectStatusSchema = z.object({
  id: z.string().min(1),
  status: z.string().refine(isProjectStatus, "Choose a valid status"),
});

/** Shared by `saveProjectNotes`. */
export const projectNotesSchema = z.object({
  id: z.string().min(1),
  notes: z.string().trim().max(20000, "Keep notes under 20000 characters"),
});

/** Shared by `linkIdeaToProject`/`unlinkIdeaFromProject`. */
export const projectIdeaLinkSchema = z.object({
  projectId: z.string().min(1),
  ideaId: z.string().min(1),
});
