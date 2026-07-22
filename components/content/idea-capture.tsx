"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { IdeaEditor } from "./idea-editor";

/**
 * The floating "New idea" button (bottom-right thumb zone, above the bottom
 * nav) that opens `IdeaEditor` in create mode — no lifted dialog controller,
 * the same self-contained pattern as `EventChip`/`EventBlock` in
 * docs/calendar.md. The form itself lives in `IdeaEditor`, shared with the
 * per-card edit flow (see docs/content-ideas.md).
 */
export function IdeaCapture() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.75rem)] z-30 shadow-lg md:right-6 md:bottom-6"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden />
        New idea
      </Button>

      <IdeaEditor mode="create" open={open} onOpenChange={setOpen} />
    </>
  );
}
