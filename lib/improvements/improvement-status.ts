/**
 * The improvement lifecycle vocabulary — single source of truth for
 * `lib/db/schema.ts`'s `improvement_status` enum and the backlog page's
 * status control (see docs/improvements.md). Order is pipeline order, not
 * alphabetical.
 */
export const IMPROVEMENT_STATUSES = [
  "proposed",
  "discussed",
  "accepted",
  "rejected",
  "done",
] as const;

export type ImprovementStatus = (typeof IMPROVEMENT_STATUSES)[number];

export const INITIAL_IMPROVEMENT_STATUS: ImprovementStatus = "proposed";

export const IMPROVEMENT_STATUS_LABEL: Record<ImprovementStatus, string> = {
  proposed: "Proposed",
  discussed: "Discussed",
  accepted: "Accepted",
  rejected: "Rejected",
  done: "Done",
};

/**
 * The plain status quick-switch only offers the statuses reachable without
 * recording an outcome — `accepted`/`rejected` are only reachable through
 * `recordImprovementOutcome` (see docs/improvements.md).
 */
export const IMPROVEMENT_SELECTABLE_STATUSES: ImprovementStatus[] = [
  "proposed",
  "discussed",
  "done",
];

/** Statuses reachable only via `recordImprovementOutcome`, never the plain status select. */
export const IMPROVEMENT_OUTCOME_STATUSES = ["accepted", "rejected"] as const;

export type ImprovementOutcomeStatus =
  (typeof IMPROVEMENT_OUTCOME_STATUSES)[number];

export function isImprovementStatus(
  value: unknown
): value is ImprovementStatus {
  return (
    typeof value === "string" &&
    (IMPROVEMENT_STATUSES as readonly string[]).includes(value)
  );
}

export function isImprovementOutcomeStatus(
  value: unknown
): value is ImprovementOutcomeStatus {
  return (
    typeof value === "string" &&
    (IMPROVEMENT_OUTCOME_STATUSES as readonly string[]).includes(value)
  );
}
