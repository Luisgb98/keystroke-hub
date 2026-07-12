"use client";

import { useState } from "react";
import { Briefcase, Trash2 } from "lucide-react";

import type { MeetingNoteWithLinks } from "@/lib/data/meeting-notes";
import { MEETING_TYPE_LABEL } from "@/lib/meetings/meeting-type";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { DeleteMeetingNoteDialog } from "./delete-meeting-note-dialog";

interface MeetingNoteDetailHeaderProps {
  meetingNote: MeetingNoteWithLinks;
}

/**
 * Work-track marker (`Briefcase` + track-work tokens, per
 * docs/design-system.md) + type badge, and the delete action — mirrors
 * `StreamDetailHeader`'s hard-delete wiring; there's no archive concept
 * here (see docs/meetings.md).
 */
export function MeetingNoteDetailHeader({
  meetingNote,
}: MeetingNoteDetailHeaderProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="gap-1 border-track-work-border bg-track-work text-track-work-foreground"
        >
          <Briefcase aria-hidden className="size-3" />
          Work
        </Badge>
        <Badge variant="secondary">
          {MEETING_TYPE_LABEL[meetingNote.meetingType]}
        </Badge>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 aria-hidden className="size-4" />
        Delete
      </Button>

      <DeleteMeetingNoteDialog
        meetingNote={meetingNote}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
