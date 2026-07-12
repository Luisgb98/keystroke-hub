"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { updateImprovementStatus } from "@/lib/improvements/actions";
import {
  IMPROVEMENT_SELECTABLE_STATUSES,
  IMPROVEMENT_STATUS_LABEL,
  type ImprovementStatus,
} from "@/lib/improvements/improvement-status";

interface ImprovementStatusSelectProps {
  improvementId: string;
  status: ImprovementStatus;
  disabled?: boolean;
}

/**
 * Inline status quick-switch — commits immediately, no confirmation, mirrors
 * `ProjectStatusSelect`. Only offers the statuses reachable without
 * recording an outcome; `accepted`/`rejected` come from
 * `RecordOutcomeDialog` instead (see docs/improvements.md). When the current
 * status is `accepted`/`rejected`, it's shown as a disabled current option
 * alongside the selectable ones so the select never silently drops it.
 */
export function ImprovementStatusSelect({
  improvementId,
  status,
  disabled = false,
}: ImprovementStatusSelectProps) {
  const [pending, startTransition] = useTransition();
  const options = IMPROVEMENT_SELECTABLE_STATUSES.includes(status)
    ? IMPROVEMENT_SELECTABLE_STATUSES
    : [status, ...IMPROVEMENT_SELECTABLE_STATUSES];

  function handleChange(next: string) {
    startTransition(async () => {
      const result = await updateImprovementStatus(improvementId, next);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <>
      <label
        className="sr-only"
        htmlFor={`improvement-status-${improvementId}`}
      >
        Status
      </label>
      <select
        id={`improvement-status-${improvementId}`}
        value={status}
        disabled={disabled || pending}
        onChange={(e) => handleChange(e.target.value)}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {IMPROVEMENT_STATUS_LABEL[option]}
          </option>
        ))}
      </select>
    </>
  );
}
