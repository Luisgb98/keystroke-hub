import { z } from "zod";

import type { Track } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The final, DB-ready shape produced by `eventFormSchema` on success. */
export interface EventInput {
  title: string;
  track: Track;
  description: string | null;
  allDay: boolean;
  startsAt: Date;
  endsAt: Date;
}

/** Local midnight for a `yyyy-MM-dd` string — matches `parseDateParam` in `range.ts`. */
function parseLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

/** Local date+time for `yyyy-MM-dd` + `HH:mm` strings. */
function combineDateAndTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

const rawEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Keep the title under 200 characters"),
  // Validated manually (not z.enum) so the "never ambiguous" requirement gets
  // a specific, UI-facing message rather than zod's generic invalid-value one.
  track: z
    .string()
    .optional()
    .refine(
      (value): value is Track => value === "work" || value === "content",
      "Choose a track"
    ),
  description: z
    .string()
    .trim()
    .max(2000, "Keep the description under 2000 characters")
    .optional(),
  allDay: z.boolean(),
  startDate: z.string().regex(DATE_RE, "Enter a valid start date"),
  // Absent entirely for all-day events (the time inputs are disabled, so a
  // native form omits them from FormData) — required only when timed.
  startTime: z.string().regex(TIME_RE, "Enter a valid start time").optional(),
  endDate: z.string().regex(DATE_RE, "Enter a valid end date"),
  endTime: z.string().regex(TIME_RE, "Enter a valid end time").optional(),
});

/**
 * Shared by the create/edit form and both server actions: parses raw
 * form-shaped input into the final `{ startsAt, endsAt }` DB shape. All-day
 * events are normalized to local-midnight date boundaries (see
 * docs/calendar.md) — a single-day all-day event has `startsAt === endsAt`.
 */
export const eventFormSchema = rawEventSchema.transform((data, ctx) => {
  const description =
    data.description && data.description.length > 0 ? data.description : null;

  let startsAt: Date;
  let endsAt: Date;

  if (data.allDay) {
    startsAt = parseLocalDate(data.startDate);
    endsAt = parseLocalDate(data.endDate);
  } else {
    if (!data.startTime) {
      ctx.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "Start time is required",
      });
    }
    if (!data.endTime) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time is required",
      });
    }
    if (!data.startTime || !data.endTime) return z.NEVER;

    startsAt = combineDateAndTime(data.startDate, data.startTime);
    endsAt = combineDateAndTime(data.endDate, data.endTime);
  }

  if (endsAt.getTime() < startsAt.getTime()) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End must be after start",
    });
    return z.NEVER;
  }

  // Guaranteed valid here: a failed `track` refine short-circuits parsing
  // before this transform ever runs.
  const result: EventInput = {
    title: data.title,
    track: data.track as Track,
    description,
    allDay: data.allDay,
    startsAt,
    endsAt,
  };
  return result;
});
