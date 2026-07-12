"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteMeetingNote } from "@/lib/meetings/actions";
import type { MeetingNoteWithLinks } from "@/lib/data/meeting-notes";
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

interface DeleteMeetingNoteDialogProps {
  meetingNote: MeetingNoteWithLinks;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Hard delete with confirmation, no soft-archive — mirrors
 * `DeleteStreamDialog`. Linked improvements survive (only the join rows
 * cascade away) and a linked calendar event, if any, is left alone (see
 * docs/meetings.md).
 */
export function DeleteMeetingNoteDialog({
  meetingNote,
  open,
  onOpenChange,
}: DeleteMeetingNoteDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteMeetingNote(meetingNote.id);
      if (result.error) {
        toast.error(result.error);
        onOpenChange(false);
        return;
      }
      toast.success(`"${meetingNote.title}" deleted`);
      onOpenChange(false);
      router.push("/projects/meetings");
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this meeting note?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{meetingNote.title}&rdquo; will be permanently deleted. This
            can&apos;t be undone. Linked improvements and the calendar event, if
            any, will be left alone.
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
