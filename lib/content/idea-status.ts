/**
 * The idea pipeline vocabulary — single source of truth for `lib/db/schema.ts`'s
 * `idea_status` enum, this list view's status control, and #16's board (see
 * docs/content-ideas.md). Order is pipeline order, not alphabetical. `edited`
 * was added by #16, between `recorded` and `published`.
 */
export const IDEA_STATUSES = [
  "spark",
  "outlined",
  "scripted",
  "recorded",
  "edited",
  "published",
  "parked",
] as const;

export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const INITIAL_IDEA_STATUS: IdeaStatus = "spark";

/** `parked` is reversible (see #16's move menu) but visually a side-track, not the happy path — rendered last and muted on the board. */
export const PARKED_IDEA_STATUS: IdeaStatus = "parked";

export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  spark: "Spark",
  outlined: "Outlined",
  scripted: "Scripted",
  recorded: "Recorded",
  edited: "Edited",
  published: "Published",
  parked: "Parked",
};

/** Per-stage copy for #16's board columns — teaches the pipeline when a column is empty. */
export const IDEA_STATUS_EMPTY_STATE_COPY: Record<IdeaStatus, string> = {
  spark: "No sparks waiting — capture one the moment it hits.",
  outlined: "Nothing outlined — turn a spark into a plan.",
  scripted: "Nothing scripted — pick an idea and write.",
  recorded: "Nothing recorded — grab a script and hit record.",
  edited: "Nothing in the edit bay — cut a recording next.",
  published: "Nothing published yet — finish an edit and ship it.",
  parked: "Nothing parked — dead ideas land here, reversibly.",
};

export function isIdeaStatus(value: unknown): value is IdeaStatus {
  return (
    typeof value === "string" &&
    (IDEA_STATUSES as readonly string[]).includes(value)
  );
}
