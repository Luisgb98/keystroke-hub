/**
 * The idea pipeline vocabulary — single source of truth for `lib/db/schema.ts`'s
 * `idea_status` enum, this list view's status control, and issue #16's future
 * board (see docs/content-ideas.md). Order is pipeline order, not alphabetical.
 */
export const IDEA_STATUSES = [
  "spark",
  "outlined",
  "scripted",
  "recorded",
  "published",
  "parked",
] as const;

export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const INITIAL_IDEA_STATUS: IdeaStatus = "spark";

export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  spark: "Spark",
  outlined: "Outlined",
  scripted: "Scripted",
  recorded: "Recorded",
  published: "Published",
  parked: "Parked",
};

export function isIdeaStatus(value: unknown): value is IdeaStatus {
  return (
    typeof value === "string" &&
    (IDEA_STATUSES as readonly string[]).includes(value)
  );
}
