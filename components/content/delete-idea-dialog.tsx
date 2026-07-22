"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { deleteIdea } from "@/lib/content/actions";
import type { Idea } from "@/lib/db/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteIdeaDialogProps {
  idea: Idea;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether a non-empty script is saved for this idea — its script is deleted too, via `on delete cascade` (see docs/scripts.md). */
  hasScript?: boolean;
  /** Whether this idea is linked to any calendar events — those links cascade-delete too (see docs/content-links.md). */
  hasScheduledEvents?: boolean;
  /**
   * Called after a successful delete. The list/board surfaces revalidate away
   * on their own, but the idea detail page (#73) must navigate off the
   * now-deleted idea — it passes a push back to the ideas list here.
   */
  onDeleted?: () => void;
}

/** Hard delete with confirmation — no soft-archive (see docs/content-ideas.md). */
export function DeleteIdeaDialog({
  idea,
  open,
  onOpenChange,
  hasScript = false,
  hasScheduledEvents = false,
  onDeleted,
}: DeleteIdeaDialogProps) {
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteIdea(idea.id);
      if (result.error) {
        toast.error(result.error);
        onOpenChange(false);
        return;
      }
      toast.success(`"${idea.title}" deleted`);
      onOpenChange(false);
      onDeleted?.();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this idea?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{idea.title}&rdquo; will be permanently deleted. This
            can&apos;t be undone.
            {hasScript ? " Its script will be deleted too." : ""}
            {hasScheduledEvents
              ? " Its calendar links will be removed too."
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
