"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import type { GameOption } from "@/lib/data/games";
import { Button } from "@/components/ui/button";

import { IdeaEditor } from "./idea-editor";

interface IdeaCaptureProps {
  /** The whole game library, for the editor's picker (#105). */
  games?: GameOption[];
}

/**
 * The "New idea" primary action for /content/ideas: its own inline button in
 * the page header (Issue #85 retired the floating dock that used to render it)
 * plus the create-mode `IdeaEditor` dialog it opens. The form itself lives in
 * `IdeaEditor`, shared with the per-card edit flow (see docs/content-ideas.md).
 */
export function IdeaCapture({ games = [] }: IdeaCaptureProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        New idea
      </Button>

      <IdeaEditor
        mode="create"
        games={games}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
