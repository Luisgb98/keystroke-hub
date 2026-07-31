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
 * The board card's publish-checklist progress indicator — a `n/m` pill, ringed
 * so it reads as a chip rather than a stray label, and filled with the
 * content-track surface once complete so "ready to publish" scans down a column
 * (see docs/content-ideas.md). Renders nothing for ideas with no checklist rows
 * yet (early pipeline stages) — the dialog itself is owned by `PipelineBoard`
 * so the publish nudge toast can open it too.
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
      size="xs"
      aria-label={`Open publish checklist for "${ideaTitle}" (${done} of ${total} done)`}
      onClick={onOpen}
      className={cn(
        "gap-1 rounded-full font-mono text-caption ring-1",
        complete
          ? "bg-track-content/70 text-track-content-foreground ring-track-content-border/60 hover:bg-track-content"
          : "text-muted-foreground ring-border"
      )}
    >
      {complete ? <Check aria-hidden className="size-3" /> : null}
      {done}/{total}
    </Button>
  );
}
