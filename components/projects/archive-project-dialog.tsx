"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { archiveProject } from "@/lib/projects/actions";
import type { Project } from "@/lib/db/schema";
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

interface ArchiveProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Archive, not delete — the only way off the active list, and reversible via "Unarchive". Linked ideas keep their reference (see docs/projects.md). */
export function ArchiveProjectDialog({
  project,
  open,
  onOpenChange,
}: ArchiveProjectDialogProps) {
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await archiveProject(project.id);
      if (result.error) {
        toast.error(result.error);
        onOpenChange(false);
        return;
      }
      toast.success(`"${project.name}" archived`);
      onOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive this project?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{project.name}&rdquo; moves to the Archived list. Linked
            ideas keep their reference, and you can unarchive it any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={handleConfirm}>
            {pending ? "Archiving…" : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
