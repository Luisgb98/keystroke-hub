import { z } from "zod";

import {
  isImprovementOutcomeStatus,
  isImprovementStatus,
} from "./improvement-status";

/** The final, DB-ready shape produced by `improvementCaptureSchema` on success. */
export interface ImprovementInput {
  title: string;
  rationale: string | null;
  projectId: string | null;
}

const rawImprovementCaptureSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Keep the title under 200 characters"),
  rationale: z
    .string()
    .trim()
    .max(2000, "Keep the rationale under 2000 characters")
    .optional(),
  projectId: z.string().trim().optional(),
});

/**
 * Shared by the capture form and `createImprovement`. Title is the only
 * required field (quick-add) — rationale and the optional project link live
 * in the expanded capture view, not the frictionless first step (see
 * docs/improvements.md).
 */
export const improvementCaptureSchema = rawImprovementCaptureSchema.transform(
  (data): ImprovementInput => ({
    title: data.title,
    rationale:
      data.rationale && data.rationale.length > 0 ? data.rationale : null,
    projectId:
      data.projectId && data.projectId.length > 0 ? data.projectId : null,
  })
);

/**
 * Shared by `updateImprovementDetails`: title, rationale, and the project
 * link are the only fields editable here — status and outcome have their
 * own single-purpose actions below.
 */
export const improvementDetailsSchema = z.object({
  id: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Keep the title under 200 characters"),
  rationale: z
    .string()
    .trim()
    .max(2000, "Keep the rationale under 2000 characters")
    .optional(),
  projectId: z.string().trim().optional(),
});

/**
 * Shared by `updateImprovementStatus` — deliberately excludes
 * `accepted`/`rejected`, which are only reachable through
 * `recordImprovementOutcome` (see docs/improvements.md).
 */
export const improvementStatusSchema = z.object({
  id: z.string().min(1),
  status: z
    .string()
    .refine(
      (value) =>
        isImprovementStatus(value) && !isImprovementOutcomeStatus(value),
      "Choose a valid status"
    ),
});

/** Shared by `recordImprovementOutcome`. Outcome text is optional — can be added later. */
export const improvementOutcomeSchema = z.object({
  id: z.string().min(1),
  status: z
    .string()
    .refine(isImprovementOutcomeStatus, "Choose accepted or rejected"),
  outcome: z
    .string()
    .trim()
    .max(2000, "Keep the outcome under 2000 characters")
    .optional(),
});
