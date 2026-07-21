import { z } from "zod";

import {
  IDEA_FORMATS,
  INITIAL_IDEA_FORMAT,
  type IdeaFormat,
} from "./idea-format";
import { isIdeaStatus } from "./idea-status";

const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;

/** The final, DB-ready shape produced by `ideaCaptureSchema` on success. */
export interface IdeaInput {
  title: string;
  notes: string | null;
  format: IdeaFormat;
  tags: string[];
}

/**
 * Normalizes free-form tag input (a single comma-separated text field — see
 * docs/content-ideas.md): trims, lowercases, drops empties, dedupes while
 * preserving first-seen order, and truncates gracefully (long tags/tag
 * counts shouldn't be able to break capture, per the issue's edge cases).
 */
export function normalizeTags(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
    if (tag.length === 0 || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

const rawIdeaCaptureSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Keep the title under 200 characters"),
  notes: z
    .string()
    .trim()
    .max(4000, "Keep notes under 4000 characters")
    .optional(),
  // Validated manually (not z.enum), mirroring lib/calendar/event-schema.ts's
  // `track` field, for a UI-facing message. Absent/empty is not an error —
  // format defaults to "either" so it stays optional, per "capture in
  // seconds" (only the title is required).
  format: z
    .string()
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        value === "" ||
        (IDEA_FORMATS as readonly string[]).includes(value),
      "Choose a valid format"
    ),
  // Raw comma-separated tag input from a single text field; normalized by
  // the transform below rather than validated shape-first.
  tags: z.string().optional(),
});

/** Shared by the capture form and `createIdea`: parses raw form-shaped input into the DB-ready shape. */
export const ideaCaptureSchema = rawIdeaCaptureSchema.transform(
  (data): IdeaInput => {
    const notes = data.notes && data.notes.length > 0 ? data.notes : null;
    const format: IdeaFormat =
      data.format && data.format.length > 0
        ? (data.format as IdeaFormat)
        : INITIAL_IDEA_FORMAT;
    return {
      title: data.title,
      notes,
      format,
      tags: normalizeTags(data.tags),
    };
  }
);

/** Shared by `updateIdeaStatus`: the only field editable after capture (see docs/content-ideas.md). */
export const ideaStatusSchema = z.object({
  id: z.string().min(1),
  status: z.string().refine(isIdeaStatus, "Choose a valid status"),
});
