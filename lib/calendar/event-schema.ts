import { z } from "zod";

import { parseAppDate, parseAppDateTime } from "@/lib/time";

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
 * form-shaped input into the final `{ startsAt, endsAt }` DB shape. The
 * wall-clock strings are read in the app timezone (see lib/time), never in
 * the server's own zone — that is what keeps a 19:00 event 19:00 after a save
 * on Vercel (issue #95). All-day events are normalized to app-timezone
 * midnight date boundaries (see docs/calendar.md) — a single-day all-day event
 * has `startsAt === endsAt`.
 */
export const eventFormSchema = rawEventSchema.transform((data, ctx) => {
  const description =
    data.description && data.description.length > 0 ? data.description : null;

  let startsAt: Date | null;
  let endsAt: Date | null;

  if (data.allDay) {
    startsAt = parseAppDate(data.startDate);
    endsAt = parseAppDate(data.endDate);
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

    startsAt = parseAppDateTime(data.startDate, data.startTime);
    endsAt = parseAppDateTime(data.endDate, data.endTime);
  }

  // `DATE_RE` only checks the shape, so a well-formed but nonexistent day
  // (2026-02-30) still reaches here — reject it rather than storing an
  // Invalid Date.
  if (!startsAt) {
    ctx.addIssue({
      code: "custom",
      path: ["startDate"],
      message: "Enter a valid start date",
    });
  }
  if (!endsAt) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "Enter a valid end date",
    });
  }
  if (!startsAt || !endsAt) return z.NEVER;

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

/** Shared by `rescheduleEvent`: a drag/resize only ever rewrites the time bounds. */
export const rescheduleSchema = z
  .object({
    id: z.string().min(1),
    startsAt: z.date(),
    endsAt: z.date(),
  })
  .refine((data) => data.endsAt.getTime() >= data.startsAt.getTime(), {
    message: "End must be after start",
    path: ["endsAt"],
  });
