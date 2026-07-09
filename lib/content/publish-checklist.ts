import type { IdeaStatus } from "./idea-status";

/**
 * Single source of truth for the video publishing checklist's default items
 * — a code constant, not a template table, since a single-user app has no
 * need for template management at this scope (see docs/content-ideas.md).
 * `updateIdeaStatus` snapshots these onto an idea the first time it enters a
 * late stage; later per-video edits never touch this list again.
 */
export const DEFAULT_PUBLISH_CHECKLIST_ITEMS = [
  "Title",
  "Thumbnail",
  "Description",
  "Tags",
] as const;

/** The pipeline stages a video is considered "late pipeline" at — the seeding trigger for the publish checklist. */
export const LATE_IDEA_STATUSES: readonly IdeaStatus[] = [
  "recorded",
  "edited",
  "published",
];

export function isLateStage(status: IdeaStatus): boolean {
  return (LATE_IDEA_STATUSES as readonly string[]).includes(status);
}
