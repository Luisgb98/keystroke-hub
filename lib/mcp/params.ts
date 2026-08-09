import { z } from "zod";

import { IDEA_FORMATS } from "@/lib/content/idea-format";
import { IDEA_STATUSES } from "@/lib/content/idea-status";

/**
 * Reusable parameter schemas for the MCP tools. Deliberately thin: the real
 * validation is the app's own (`lib/content/*-schema.ts`,
 * `lib/calendar/event-schema.ts`), which every write goes through afterwards.
 * These only catch the shape errors worth a specific message before the domain
 * ever sees them (issue #109).
 */

export const idParam = z.string().min(1, "An id is required");

export const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a yyyy-MM-dd date, e.g. 2026-08-01");

export const timeParam = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    "Use a 24-hour HH:mm time in the app timezone, e.g. 19:00"
  );

export const ideaFormatParam = z.enum(IDEA_FORMATS);

export const ideaStatusParam = z.enum(IDEA_STATUSES);

/**
 * Tags cross the wire as an array (an MCP client has no comma-separated text
 * field to fill) and are joined back into the one raw string `normalizeTags`
 * owns — so trimming, lowercasing, deduping and the 5-tag publishing standard
 * behave identically to a capture typed into the dialog.
 */
export const tagsParam = z
  .array(z.string())
  .describe(
    "Hashtags for the idea. Normalised exactly as the UI does: trimmed, lowercased and deduped. More than 5 is rejected — that's the publishing standard."
  );

/** Tags carry commas nowhere in this app, so joining on one is lossless. */
export function tagsToRaw(tags: string[] | undefined): string | undefined {
  return tags === undefined ? undefined : tags.join(",");
}
