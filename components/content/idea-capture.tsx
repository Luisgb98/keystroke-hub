"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { IdeaEditor } from "./idea-editor";

/**
 * The "New idea" primary action for /content/ideas: its own inline button in
 * the page header (Issue #85 retired the floating dock that used to render it)
 * plus the create-mode `IdeaEditor` dialog it opens. The form itself lives in
 * `IdeaEditor`, shared with the per-card edit flow (see docs/content-ideas.md).
 */
export function IdeaCapture() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        New idea
      </Button>

      <IdeaEditor mode="create" open={open} onOpenChange={setOpen} />
    </>
  );
}
