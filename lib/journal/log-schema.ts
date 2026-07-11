import { z } from "zod";

import { weekStartParam } from "./week-dates";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const logDateSchema = z.string().regex(DATE_RE, "Invalid date");

/** Normalizes to the week's Monday before write, so `weekly_reviews.week_start` is always a Monday (see docs/journal.md). */
export const weekStartSchema = z
  .string()
  .regex(DATE_RE, "Invalid date")
  .transform((value) => weekStartParam(value));

const MAX_TITLE_LENGTH = 200;
const MAX_RETRO_LENGTH = 4000;
const MAX_HIGHLIGHTS_LENGTH = 4000;

/** Shared by `addItem` / `editItemTitle`. */
export const itemTitleSchema = z
  .string()
  .trim()
  .min(1, "Title is required")
  .max(MAX_TITLE_LENGTH, `Keep it under ${MAX_TITLE_LENGTH} characters`);

/** Shared by `saveRetro`. */
export const retroSchema = z.object({
  logDate: logDateSchema,
  retro: z
    .string()
    .trim()
    .max(MAX_RETRO_LENGTH, `Keep it under ${MAX_RETRO_LENGTH} characters`),
});

/** Shared by `saveMood`. `null` clears a previously-set mood. */
export const moodSchema = z.object({
  logDate: logDateSchema,
  mood: z.number().int().min(1).max(5).nullable(),
});

/** Shared by `saveHighlights`. */
export const highlightsSchema = z.object({
  weekStart: weekStartSchema,
  highlights: z
    .string()
    .trim()
    .max(
      MAX_HIGHLIGHTS_LENGTH,
      `Keep it under ${MAX_HIGHLIGHTS_LENGTH} characters`
    ),
});
