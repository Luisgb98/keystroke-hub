"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ChecklistChipProps {
  ideaTitle: string;
  done: number;
  total: number;
  onOpen: () => void;
}

/**
 * The board card's publish-checklist progress indicator — `n/m`, complete
 * state styled with the content-track accent so "ready to publish" scans
 * across the column (see docs/content-ideas.md). Renders nothing for ideas
 * with no checklist rows yet (early pipeline stages) — the dialog itself is
 * owned by `PipelineBoard` so the publish nudge toast can open it too.
 */
export function ChecklistChip({
  ideaTitle,
  done,
  total,
  onOpen,
}: ChecklistChipProps) {
  if (total === 0) return null;
  const complete = done === total;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={`Open publish checklist for "${ideaTitle}" (${done} of ${total} done)`}
      onClick={onOpen}
      className={cn(
        "gap-1 font-mono text-caption",
        complete ? "text-track-content-foreground" : "text-muted-foreground"
      )}
    >
      {complete ? <Check aria-hidden className="size-3.5" /> : null}
      {done}/{total}
    </Button>
  );
}
