"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { IDEA_FORMAT_LABEL } from "@/lib/content/idea-format";
import type { Idea } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";

import { DeleteIdeaDialog } from "../delete-idea-dialog";
import { IdeaEditor } from "../idea-editor";
import { IDEA_FORMAT_ICON } from "../idea-format-styles";

interface IdeaDetailHeaderProps {
  idea: Idea;
  /** The idea's release event start, if scheduled — prefills the edit dialog's date/time. */
  releaseStartsAt: Date | null;
  /** Whether a non-empty script exists — drives the delete dialog's extra warning. */
  hasScript: boolean;
  /** Whether the idea is linked to any calendar events — drives the delete dialog's warning. */
  hasScheduledEvents: boolean;
}

/**
 * Track identity + edit/delete actions for the idea detail page (#73) —
 * mirrors `StreamDetailHeader`'s dialog wiring, reusing the same `IdeaEditor`
 * and `DeleteIdeaDialog` the card uses. A successful delete navigates back to
 * the ideas list, since the current idea no longer exists.
 */
export function IdeaDetailHeader({
  idea,
  releaseStartsAt,
  hasScript,
  hasScheduledEvents,
}: IdeaDetailHeaderProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const Icon = IDEA_FORMAT_ICON[idea.format];

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2 text-caption text-muted-foreground">
        <Icon aria-hidden className="size-4 shrink-0" />
        <span>{IDEA_FORMAT_LABEL[idea.format]}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Edit "${idea.title}"`}
          onClick={() => setEditOpen(true)}
        >
          <Pencil aria-hidden className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Delete "${idea.title}"`}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 aria-hidden className="size-4" />
        </Button>
      </div>

      <IdeaEditor
        mode="edit"
        idea={idea}
        releaseStartsAt={releaseStartsAt}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <DeleteIdeaDialog
        idea={idea}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        hasScheduledEvents={hasScheduledEvents}
        hasScript={hasScript}
        onDeleted={() => router.push("/content/ideas")}
      />
    </div>
  );
}
