import { z } from "zod";

const MAX_CHECKLIST_LABEL_LENGTH = 200;

/** Shared by `addIdeaChecklistItem` — mirrors `stream-schema.ts`'s `checklistLabelSchema`. */
export const checklistLabelSchema = z
  .string()
  .trim()
  .min(1, "Label is required")
  .max(
    MAX_CHECKLIST_LABEL_LENGTH,
    `Keep it under ${MAX_CHECKLIST_LABEL_LENGTH} characters`
  );
