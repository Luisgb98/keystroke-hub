"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { updateIdeaStatus } from "@/lib/content/actions";
import {
  IDEA_STATUSES,
  IDEA_STATUS_LABEL,
  isIdeaStatus,
  type IdeaStatus,
} from "@/lib/content/idea-status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface IdeaStatusSelectProps {
  ideaId: string;
  status: IdeaStatus;
  /** Trigger size — `"sm"` on the compact card, default on the roomier detail page. */
  size?: "sm" | "default";
}

/**
 * The themed shadcn status `Select` shared by `IdeaCard` and the idea detail
 * page. Status commits inline through `updateIdeaStatus` (no confirmation —
 * cheap to change back, same action the board's move menu uses; see
 * docs/content-ideas.md), and publishing with unchecked checklist items nudges
 * with a plain toast rather than the board card's chip/dialog, which this
 * surface doesn't own.
 *
 * The shown value is optimistic, matching `PipelineBoard`'s handling of this
 * same mutation. Reading it straight off the `status` prop meant the trigger
 * kept displaying the *old* status — greyed out, since it disables while
 * pending — until the revalidated page arrived, which on `/content/ideas`
 * (two sequential waves of queries) is seconds. "Commits inline" has to look
 * like it committed. A failed action needs no rollback code: the transition
 * settling without a revalidated `status` prop reverts the optimistic value on
 * its own (#102).
 */
export function IdeaStatusSelect({
  ideaId,
  status,
  size = "sm",
}: IdeaStatusSelectProps) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status);
  const [pending, startTransition] = useTransition();

  function handleStatusChange(next: string) {
    // Narrowed rather than cast: the optimistic value has to be a real status,
    // and `SelectItem` can only ever offer one, so this never rejects in
    // practice — the server re-validates regardless.
    if (!isIdeaStatus(next)) return;
    startTransition(async () => {
      setOptimisticStatus(next);
      const result = await updateIdeaStatus(ideaId, next);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (next === "published" && (result.uncheckedCount ?? 0) > 0) {
        const count = result.uncheckedCount ?? 0;
        toast(
          `Published with ${count} unchecked checklist item${count === 1 ? "" : "s"}`
        );
      }
    });
  }

  return (
    <Select
      value={optimisticStatus}
      onValueChange={(value) => {
        if (value) handleStatusChange(value);
      }}
      disabled={pending}
    >
      <SelectTrigger aria-label="Status" size={size}>
        <SelectValue>
          {(value) => (isIdeaStatus(value) ? IDEA_STATUS_LABEL[value] : null)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {IDEA_STATUSES.map((value) => (
          <SelectItem key={value} value={value}>
            {IDEA_STATUS_LABEL[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
