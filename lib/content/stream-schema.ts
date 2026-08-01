import { z } from "zod";

import { parseAppDate, parseAppDateTime } from "@/lib/time";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** New content-track events created from the stream planner default to a 2h slot (see docs/content-streams.md). */
export const DEFAULT_STREAM_DURATION_MS = 2 * 60 * 60 * 1000;

export interface StreamScheduleInput {
  allDay: boolean;
  startsAt: Date;
  endsAt: Date;
}

/** The final, DB-ready shape produced by `streamCaptureSchema` on success. */
export interface StreamCaptureInput {
  title: string;
  notes: string | null;
  /** `null` means the stream is created unscheduled. */
  schedule: StreamScheduleInput | null;
}

const rawStreamCaptureSchema = z.object({
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
  // Whether to create a content-track event for this stream at all — the
  // date/time fields below only matter when this is true.
  planned: z.boolean(),
  allDay: z.boolean().optional(),
  date: z.string().regex(DATE_RE, "Pick a valid date").optional(),
  time: z.string().regex(TIME_RE, "Pick a valid time").optional(),
});

/**
 * Shared by the create form and `createStream`. Unlike `eventFormSchema`,
 * only a start date/time is collected — the end is a fixed 2h slot (or the
 * same day, for all-day) rather than a second picker, matching "capture in
 * seconds" (see docs/content-streams.md). The wall clock is read in the app
 * timezone (see lib/time), not the server's own (issue #95).
 */
export const streamCaptureSchema = rawStreamCaptureSchema.transform(
  (data, ctx) => {
    const notes = data.notes && data.notes.length > 0 ? data.notes : null;

    if (!data.planned) {
      const result: StreamCaptureInput = {
        title: data.title,
        notes,
        schedule: null,
      };
      return result;
    }

    if (!data.date) {
      ctx.addIssue({ code: "custom", path: ["date"], message: "Pick a date" });
      return z.NEVER;
    }

    const allDay = data.allDay ?? false;

    if (!allDay && !data.time) {
      ctx.addIssue({
        code: "custom",
        path: ["time"],
        message: "Pick a start time",
      });
      return z.NEVER;
    }

    const startsAt = allDay
      ? parseAppDate(data.date)
      : parseAppDateTime(data.date, data.time!);

    // `DATE_RE` only checks the shape, so a well-formed but nonexistent day
    // (2026-02-30) still reaches here — reject it rather than scheduling the
    // stream at an Invalid Date.
    if (!startsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["date"],
        message: "Pick a valid date",
      });
      return z.NEVER;
    }

    // All-day streams are a single date-scoped day (`startsAt === endsAt`,
    // see docs/calendar.md); timed ones get the fixed 2h slot.
    const endsAt = allDay
      ? startsAt
      : new Date(startsAt.getTime() + DEFAULT_STREAM_DURATION_MS);

    const result: StreamCaptureInput = {
      title: data.title,
      notes,
      schedule: { allDay, startsAt, endsAt },
    };
    return result;
  }
);

/** Shared by `updateStreamDetails`: title + prep notes are the only fields editable after capture. */
export const streamDetailsSchema = z.object({
  id: z.string().min(1),
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
});

/** Shared by `saveRetroNotes`. */
export const retroNotesSchema = z.object({
  id: z.string().min(1),
  retroNotes: z.string().trim().max(4000, "Keep notes under 4000 characters"),
});

const MAX_CHECKLIST_LABEL_LENGTH = 200;

/** Shared by `addChecklistItem` and template item creation. */
export const checklistLabelSchema = z
  .string()
  .trim()
  .min(1, "Label is required")
  .max(
    MAX_CHECKLIST_LABEL_LENGTH,
    `Keep it under ${MAX_CHECKLIST_LABEL_LENGTH} characters`
  );

export const attachEventSchema = z.object({
  streamId: z.string().min(1),
  eventId: z.string().min(1),
});
