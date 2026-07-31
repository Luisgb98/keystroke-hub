"use client";

import { createPortal } from "react-dom";

import { IDEA_FORMAT_LABEL } from "@/lib/content/idea-format";
import type { DropPoint } from "@/lib/content/board-drag";
import type { Idea } from "@/lib/db/schema";
import { IDEA_FORMAT_ICON } from "@/components/content/idea-format-styles";

interface BoardDragPreviewProps {
  idea: Idea;
  point: DropPoint;
}

/**
 * The card that follows the pointer during a drag.
 *
 * A lightweight ghost rather than a transformed copy of the real card, for
 * two reasons: the card's own column is a vertical scrollport and the board a
 * horizontal one, so a translated card would be clipped the moment it left
 * its column; and leaving the real card in place means a drag never touches
 * layout, which is what keeps the gesture jank-free. Rendered into
 * `document.body` so neither scrollport can clip it, `aria-hidden` and
 * pointer-transparent — it's a visual echo of a card that is still in the DOM,
 * not a second copy of its controls.
 */
export function BoardDragPreview({ idea, point }: BoardDragPreviewProps) {
  const Icon = IDEA_FORMAT_ICON[idea.format];

  return createPortal(
    <div
      aria-hidden
      data-slot="board-drag-preview"
      style={{ left: point.x, top: point.y }}
      className="pointer-events-none fixed z-50 flex w-60 max-w-[80vw] -translate-x-1/2 -translate-y-1/2 rotate-2 flex-col gap-1.5 rounded-xl border border-track-content-border bg-track-content px-3 py-2.5 text-track-content-foreground shadow-lg"
    >
      <span className="flex items-center gap-1.5 text-caption opacity-80">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        {IDEA_FORMAT_LABEL[idea.format]}
      </span>
      <span className="line-clamp-2 font-heading text-small font-semibold">
        {idea.title}
      </span>
    </div>,
    document.body
  );
}
