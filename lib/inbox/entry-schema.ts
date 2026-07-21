import { z } from "zod";

/**
 * Upper bound on a captured thought. Quick-capture is for a sentence or a
 * paragraph jotted mid-game/mid-meeting — pasting a whole document isn't the
 * use case (see docs/inbox.md), so this caps abuse without getting in the way.
 */
export const MAX_BODY_LENGTH = 2000;

/**
 * Shared by the capture surface and `captureEntry`. A whitespace-only body is
 * rejected (`.trim().min(1)`) — capture must contain an actual thought, but
 * that's the *only* rule: no category, no title, nothing else to fill in.
 */
export const captureBodySchema = z
  .string()
  .trim()
  .min(1, "Write something to capture")
  .max(MAX_BODY_LENGTH, `Keep it under ${MAX_BODY_LENGTH} characters`);

/** The four real triage destinations (everything except `discarded`). */
export const TRIAGE_DESTINATIONS = [
  "content_idea",
  "improvement",
  "daily_log_item",
  "meeting_note",
] as const;

export type TriageDestination = (typeof TRIAGE_DESTINATIONS)[number];

export function isTriageDestination(value: string): value is TriageDestination {
  return (TRIAGE_DESTINATIONS as readonly string[]).includes(value);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_TITLE_LENGTH = 200;

/**
 * The per-destination fields a triage collects. Each variant reuses the same
 * validation rules the destination's own capture enforces (title lengths,
 * required notes/date) so triage can never create a record the destination
 * itself would reject — see `triageEntry` in `actions.ts`, which maps these
 * onto the destination row.
 */
export const triagePayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("content_idea"),
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(
        MAX_TITLE_LENGTH,
        `Keep the title under ${MAX_TITLE_LENGTH} characters`
      ),
    notes: z
      .string()
      .trim()
      .max(4000, "Keep notes under 4000 characters")
      .optional(),
  }),
  z.object({
    type: z.literal("improvement"),
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(
        MAX_TITLE_LENGTH,
        `Keep the title under ${MAX_TITLE_LENGTH} characters`
      ),
    rationale: z
      .string()
      .trim()
      .max(2000, "Keep the rationale under 2000 characters")
      .optional(),
  }),
  z.object({
    type: z.literal("daily_log_item"),
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(MAX_TITLE_LENGTH, `Keep it under ${MAX_TITLE_LENGTH} characters`),
  }),
  z.object({
    type: z.literal("meeting_note"),
    date: z.string().trim().regex(DATE_RE, "Choose a valid date"),
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(
        MAX_TITLE_LENGTH,
        `Keep the title under ${MAX_TITLE_LENGTH} characters`
      ),
    notes: z
      .string()
      .trim()
      .min(1, "Notes are required")
      .max(20000, "Keep notes under 20000 characters"),
  }),
]);

export type TriagePayload = z.infer<typeof triagePayloadSchema>;
