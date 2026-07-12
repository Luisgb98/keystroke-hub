import { z } from "zod";

import {
  INITIAL_MEETING_TYPE,
  isMeetingType,
  type MeetingType,
} from "./meeting-type";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The final, DB-ready shape produced by `meetingNoteCaptureSchema` on success. */
export interface MeetingNoteInput {
  date: string;
  title: string;
  meetingType: MeetingType;
  notes: string;
  reflection: string | null;
  projectId: string | null;
}

const rawMeetingNoteCaptureSchema = z.object({
  date: z.string().trim().regex(DATE_RE, "Choose a valid date"),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Keep the title under 200 characters"),
  // Validated manually (not z.enum), mirroring lib/content/idea-schema.ts's
  // `format` field. Absent/empty defaults to "other" rather than erroring —
  // date, title, and notes are the only fields that must be filled in (see
  // docs/meetings.md).
  meetingType: z
    .string()
    .optional()
    .refine(
      (value) => value === undefined || value === "" || isMeetingType(value),
      "Choose a valid meeting type"
    ),
  notes: z
    .string()
    .trim()
    .min(1, "Notes are required")
    .max(20000, "Keep notes under 20000 characters"),
  reflection: z
    .string()
    .trim()
    .max(2000, "Keep the reflection under 2000 characters")
    .optional(),
  projectId: z.string().trim().optional(),
});

/** Shared by the capture form and `createMeetingNote`. Date, title, and notes are the only required fields (see docs/meetings.md). */
export const meetingNoteCaptureSchema = rawMeetingNoteCaptureSchema.transform(
  (data): MeetingNoteInput => ({
    date: data.date,
    title: data.title,
    meetingType:
      data.meetingType && data.meetingType.length > 0
        ? (data.meetingType as MeetingType)
        : INITIAL_MEETING_TYPE,
    notes: data.notes,
    reflection:
      data.reflection && data.reflection.length > 0 ? data.reflection : null,
    projectId:
      data.projectId && data.projectId.length > 0 ? data.projectId : null,
  })
);

/** Shared by `updateMeetingNoteDetails`: every editable field except the linked event/improvements, which have their own attach/detach actions. */
export const meetingNoteDetailsSchema = z.object({
  id: z.string().min(1),
  date: z.string().trim().regex(DATE_RE, "Choose a valid date"),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Keep the title under 200 characters"),
  meetingType: z
    .string()
    .optional()
    .refine(
      (value) => value === undefined || value === "" || isMeetingType(value),
      "Choose a valid meeting type"
    ),
  notes: z
    .string()
    .trim()
    .min(1, "Notes are required")
    .max(20000, "Keep notes under 20000 characters"),
  reflection: z
    .string()
    .trim()
    .max(2000, "Keep the reflection under 2000 characters")
    .optional(),
  projectId: z.string().trim().optional(),
});

/** Shared by `attachEventToMeetingNote`/`detachEventFromMeetingNote`. */
export const meetingNoteEventLinkSchema = z.object({
  meetingNoteId: z.string().min(1),
  eventId: z.string().min(1),
});

/** Shared by `linkImprovementToMeetingNote`/`unlinkImprovementFromMeetingNote`. */
export const meetingNoteImprovementLinkSchema = z.object({
  meetingNoteId: z.string().min(1),
  improvementId: z.string().min(1),
});
