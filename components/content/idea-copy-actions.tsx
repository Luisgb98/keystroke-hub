"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { formatIdeaCopyBlocks } from "@/lib/content/idea-copy";
import type { Idea } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";

/** How long a copied button stays in its confirmed (check-icon) state. */
const CONFIRMATION_DELAY_MS = 2000;

interface IdeaCopyActionsProps {
  idea: Pick<Idea, "title" | "notes" | "tags">;
}

/**
 * The four one-click publish blocks on `IdeaCard` (#72): title, title + tags,
 * description + tags, and tags. Each is its own copy-to-clipboard button —
 * comfortable tap targets in a 2×2 grid, mobile-first. Copying preserves the
 * author's line breaks (the text is built by `formatIdeaCopyBlocks`); a block
 * with nothing to copy renders disabled. Follows the clipboard idiom of
 * `CopySummaryButton` (see docs/journal.md): success toast + a brief check-icon
 * confirmation, error toast when the browser blocks clipboard access.
 */
export function IdeaCopyActions({ idea }: IdeaCopyActionsProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const blocks = formatIdeaCopyBlocks(idea);

  async function handleCopy(key: string, label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success(`Copied ${label.toLowerCase()}`);
      setTimeout(
        () => setCopiedKey((current) => (current === key ? null : current)),
        CONFIRMATION_DELAY_MS
      );
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  return (
    <div data-slot="idea-copy-actions" className="grid grid-cols-2 gap-2">
      {blocks.map((block) => {
        const copied = copiedKey === block.key;
        return (
          <Button
            key={block.key}
            type="button"
            variant="outline"
            size="sm"
            className="h-10 justify-start"
            disabled={block.text === null}
            aria-label={`Copy ${block.label}`}
            onClick={() =>
              block.text !== null &&
              handleCopy(block.key, block.label, block.text)
            }
          >
            {copied ? (
              <Check aria-hidden className="text-track-content-foreground" />
            ) : (
              <Copy aria-hidden />
            )}
            <span className="truncate">{block.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
