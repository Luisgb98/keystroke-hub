"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteStream } from "@/lib/content/stream-actions";
import type { Stream } from "@/lib/db/schema";
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

interface DeleteStreamDialogProps {
  stream: Stream;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Hard delete with confirmation, no soft-archive — the linked calendar event goes with it, so no purple block outlives its session (see docs/content-streams.md). */
export function DeleteStreamDialog({
  stream,
  open,
  onOpenChange,
}: DeleteStreamDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteStream(stream.id);
      if (result.error) {
        toast.error(result.error);
        onOpenChange(false);
        return;
      }
      toast.success(`"${stream.title}" deleted`);
      onOpenChange(false);
      router.push("/content/streams");
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this stream?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{stream.title}&rdquo; and its checklist will be permanently
            deleted. This can&apos;t be undone.
            {stream.eventId
              ? " Its block on the calendar will be removed too."
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
