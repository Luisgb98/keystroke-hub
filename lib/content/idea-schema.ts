import { z } from "zod";

import {
  IDEA_FORMATS,
  INITIAL_IDEA_FORMAT,
  type IdeaFormat,
} from "./idea-format";
import { isIdeaStatus } from "./idea-status";
import {
  DEFAULT_RELEASE_TIME,
  RELEASE_EVENT_DURATION_MINUTES,
} from "./release";

const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;
/** Mirrors `scriptSaveSchema`'s cap — capture-time script and the script page share one ceiling. */
const MAX_SCRIPT_LENGTH = 200_000;

/**
 * The publishing standard: an idea reads as complete when it carries exactly
 * this many tags (#71). Fewer is allowed (quick capture stays quick, the idea
 * just reads as incomplete); more is rejected so the form drives toward the
 * standard rather than sprawling.
 */
export const PUBLISHING_TAG_STANDARD = 5;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The idea's release as a calendar time span — produced when a release date is set. */
export interface ReleaseInput {
  startsAt: Date;
  endsAt: Date;
}

/** The DB-ready shape shared by capture and edit; `release` is null for an unscheduled idea. */
export interface IdeaFields {
  title: string;
  notes: string | null;
  format: IdeaFormat;
  tags: string[];
  release: ReleaseInput | null;
}

/** Capture adds an optional inline script (edit defers script changes to the script page). */
export interface IdeaCaptureInput extends IdeaFields {
  script: string | null;
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

/** Local date+time for `yyyy-MM-dd` + `HH:mm` strings — matches `event-schema.ts`'s parsing. */
function combineDateAndTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

/**
 * Builds the release span from a form's `releaseDate`/`releaseTime`. No date →
 * no release. A date without a time defaults to 19:00 (`DEFAULT_RELEASE_TIME`),
 * the channel's standard publish slot. The end is a nominal
 * `RELEASE_EVENT_DURATION_MINUTES` block after the start (the calendar has no
 * zero-length events).
 */
function buildRelease(
  releaseDate: string | undefined,
  releaseTime: string | undefined
): ReleaseInput | null {
  if (!releaseDate) return null;
  const time =
    releaseTime && releaseTime.length > 0 ? releaseTime : DEFAULT_RELEASE_TIME;
  const startsAt = combineDateAndTime(releaseDate, time);
  const endsAt = new Date(
    startsAt.getTime() + RELEASE_EVENT_DURATION_MINUTES * 60_000
  );
  return { startsAt, endsAt };
}

// Shared raw fields for capture and edit. `format` is validated manually (not
// z.enum) for a UI-facing message, mirroring lib/calendar/event-schema.ts's
// `track`. `releaseTime` is only meaningful alongside `releaseDate`; a stray
// time without a date is ignored by `buildRelease` rather than erroring.
const sharedIdeaFields = {
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
  // Raw comma-separated tag input from a single text field; normalized by the
  // transform below rather than validated shape-first.
  tags: z.string().optional(),
  releaseDate: z
    .string()
    .regex(DATE_RE, "Enter a valid release date")
    .optional()
    .or(z.literal("")),
  releaseTime: z
    .string()
    .regex(TIME_RE, "Enter a valid release time")
    .optional()
    .or(z.literal("")),
};

function normalizeSharedFields(data: {
  title: string;
  notes?: string;
  format?: string;
  tags?: string;
  releaseDate?: string;
  releaseTime?: string;
}): IdeaFields {
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
    release: buildRelease(
      data.releaseDate && data.releaseDate.length > 0
        ? data.releaseDate
        : undefined,
      data.releaseTime
    ),
  };
}

/** Rejects more than the publishing standard's worth of tags, pointing the error at the tags field. */
function refineTagCount(
  fields: { tags: string[] },
  ctx: z.RefinementCtx
): void {
  if (fields.tags.length > PUBLISHING_TAG_STANDARD) {
    ctx.addIssue({
      code: "custom",
      path: ["tags"],
      message: `Keep it to ${PUBLISHING_TAG_STANDARD} tags — that's the publishing standard.`,
    });
  }
}

/** Shared by the capture form and `createIdea`: parses raw form-shaped input into the DB-ready shape. */
export const ideaCaptureSchema = z
  .object({
    ...sharedIdeaFields,
    script: z
      .string()
      .max(
        MAX_SCRIPT_LENGTH,
        "That script is too long — keep it under 200,000 characters."
      )
      .optional(),
  })
  .transform((data, ctx): IdeaCaptureInput => {
    const fields = normalizeSharedFields(data);
    refineTagCount(fields, ctx);
    return {
      ...fields,
      script: data.script && data.script.length > 0 ? data.script : null,
    };
  });

/** Shared by the edit form and `updateIdea`: every field editable after capture except the script (see docs/content-ideas.md). */
export const ideaEditSchema = z
  .object(sharedIdeaFields)
  .transform((data, ctx): IdeaFields => {
    const fields = normalizeSharedFields(data);
    refineTagCount(fields, ctx);
    return fields;
  });

/** Shared by `updateIdeaStatus`: the status control on the card and the board move menu (see docs/content-ideas.md). */
export const ideaStatusSchema = z.object({
  id: z.string().min(1),
  status: z.string().refine(isIdeaStatus, "Choose a valid status"),
});
