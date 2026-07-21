/**
 * The project lifecycle vocabulary — single source of truth for
 * `lib/db/schema.ts`'s `project_status` enum and the detail page's status
 * control (see docs/projects.md). Order is pipeline order, not alphabetical.
 */
export const PROJECT_STATUSES = ["active", "paused", "done"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const INITIAL_PROJECT_STATUS: ProjectStatus = "active";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "Paused",
  done: "Done",
};

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    typeof value === "string" &&
    (PROJECT_STATUSES as readonly string[]).includes(value)
  );
}
