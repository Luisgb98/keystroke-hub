import { z } from "zod";

import { parseAppDate, parseAppDateTime } from "@/lib/time";

import {
  SINGLE_DAY_MESSAGE,
  isSingleAppDay,
  isSingleDayKind,
} from "./single-day";
import { isTrackKind, trackForKind, type TrackKind } from "./track-kind";
import type { Track } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The final, DB-ready shape produced by `eventFormSchema` on success.
 *
 * `track` is the column value; `kind` is what the user picked. They differ
 * only for `stream`, which stores `content` and is told apart by its linked
 * session (see `./track-kind.ts`) — so the actions destructure `kind` off
 * before handing the rest straight to Drizzle.
 */
export interface EventInput {
  title: string;
  track: Track;
  kind: TrackKind;
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
  track: z.string().optional().refine(isTrackKind, "Choose a track"),
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
  // Optional because the editor mounts no end-date input for content-track
  // kinds (#115) — they derive it from `startDate`. Required for work, which
  // the transform below enforces.
  endDate: z.string().regex(DATE_RE, "Enter a valid end date").optional(),
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
 *
 * The span rule branches on `kind` (#115). Work events keep the full
 * start-date/end-date range. Content and stream events are **single-day**: any
 * submitted `endDate` is ignored and derived from `startDate`, so a stale
 * midnight-spanning default can't survive a track switch, and an end time at
 * or before the start is rejected in plain words. See `./single-day.ts`.
 */
export const eventFormSchema = rawEventSchema.transform((data, ctx) => {
  const description =
    data.description && data.description.length > 0 ? data.description : null;

  // Guaranteed valid here: a failed `track` refine short-circuits parsing
  // before this transform ever runs.
  const kind = data.track as TrackKind;
  const singleDay = isSingleDayKind(kind);

  // Content and stream events end on the day they start, full stop — the
  // submitted value is never consulted. Work needs a real one.
  const endDate = singleDay ? data.startDate : data.endDate;
  if (!endDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "Enter a valid end date",
    });
    return z.NEVER;
  }

  let startsAt: Date | null;
  let endsAt: Date | null;

  if (data.allDay) {
    startsAt = parseAppDate(data.startDate);
    endsAt = parseAppDate(endDate);
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
    endsAt = parseAppDateTime(endDate, data.endTime);
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

  if (singleDay) {
    // Timed content has to advance within its one day; an all-day content
    // event is already exactly that day (`startsAt === endsAt`), so only the
    // timed case can be wrong here.
    if (!data.allDay && endsAt.getTime() <= startsAt.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: SINGLE_DAY_MESSAGE,
      });
      return z.NEVER;
    }
    // Belt and braces: `endDate` is derived from `startDate`, so this can only
    // trip if a DST-shifted end time landed on the next wall-clock day.
    if (!isSingleAppDay(startsAt, endsAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: SINGLE_DAY_MESSAGE,
      });
      return z.NEVER;
    }
  } else if (endsAt.getTime() < startsAt.getTime()) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End must be after start",
    });
    return z.NEVER;
  }

  const result: EventInput = {
    title: data.title,
    track: trackForKind(kind),
    kind,
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
