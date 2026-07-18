import type { TriageDestination } from "./entry-schema";

const MAX_TITLE_LENGTH = 200;

/** First non-empty line of a captured body, truncated to a title's length. */
export function titleFromBody(body: string): string {
  const firstLine = body
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return (firstLine ?? "").slice(0, MAX_TITLE_LENGTH);
}

/** Everything after the first non-empty line — the natural "notes" remainder. */
export function remainderFromBody(body: string): string {
  const lines = body.split("\n");
  const firstIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstIndex === -1) return "";
  return lines
    .slice(firstIndex + 1)
    .join("\n")
    .trim();
}

/** Collapses a multi-line body to a single line — for destinations that are title-only (a daily-log item). */
export function singleLineFromBody(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH);
}

export interface TriagePrefill {
  title: string;
  /** Idea notes / improvement rationale / meeting notes, depending on destination. */
  secondary: string;
  /** Only meaningful for `meeting_note`. */
  date: string;
}

/**
 * The initial field values a triage dialog shows for a given destination,
 * derived from the captured text (see docs/inbox.md). The captured thought
 * maps to the destination's most natural field: an idea/improvement splits
 * into title + notes/rationale; a daily-log item is a single-line title; a
 * meeting note keeps the full text as notes and leaves the title to the user
 * (meetings are named by what they were, not the seed thought).
 */
export function prefillForDestination(
  body: string,
  type: TriageDestination,
  today: string
): TriagePrefill {
  switch (type) {
    case "content_idea":
    case "improvement":
      return {
        title: titleFromBody(body),
        secondary: remainderFromBody(body),
        date: today,
      };
    case "daily_log_item":
      return { title: singleLineFromBody(body), secondary: "", date: today };
    case "meeting_note":
      return { title: "", secondary: body.trim(), date: today };
  }
}
