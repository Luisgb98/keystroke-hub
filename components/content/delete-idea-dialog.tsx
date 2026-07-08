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
}

/** Hard delete with confirmation — no soft-archive (see docs/content-ideas.md). */
export function DeleteIdeaDialog({
  idea,
  open,
  onOpenChange,
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
