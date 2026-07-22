/**
 * The idea pipeline vocabulary — single source of truth for `lib/db/schema.ts`'s
 * `idea_status` enum, this list view's status control, and #16's board (see
 * docs/content-ideas.md). Order is pipeline order, not alphabetical. #70
 * trimmed the pipeline to the five stages that map 1:1 to real video-production
 * work — the earlier `spark`/`outlined` intake split collapsed into `idea`, and
 * the `parked` side-track was dropped (its rows migrated back to `idea`).
 */
export const IDEA_STATUSES = [
  "idea",
  "scripted",
  "recorded",
  "edited",
  "published",
] as const;

export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const INITIAL_IDEA_STATUS: IdeaStatus = "idea";

export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  idea: "Idea",
  scripted: "Scripted",
  recorded: "Recorded",
  edited: "Edited",
  published: "Published",
};

/** Per-stage copy for #16's board columns — teaches the pipeline when a column is empty. */
export const IDEA_STATUS_EMPTY_STATE_COPY: Record<IdeaStatus, string> = {
  idea: "No ideas waiting — capture one the moment it hits.",
  scripted: "Nothing scripted — pick an idea and write.",
  recorded: "Nothing recorded — grab a script and hit record.",
  edited: "Nothing in the edit bay — cut a recording next.",
  published: "Nothing published yet — finish an edit and ship it.",
};

export function isIdeaStatus(value: unknown): value is IdeaStatus {
  return (
    typeof value === "string" &&
    (IDEA_STATUSES as readonly string[]).includes(value)
  );
}
