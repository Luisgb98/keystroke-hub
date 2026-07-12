"use client";

import { useState, useTransition } from "react";
import { Unlink } from "lucide-react";
import { toast } from "sonner";

import {
  linkImprovementToMeetingNote,
  unlinkImprovementFromMeetingNote,
} from "@/lib/meetings/actions";
import { IMPROVEMENT_STATUS_LABEL } from "@/lib/improvements/improvement-status";
import type { LinkedImprovementSummary } from "@/lib/data/meeting-notes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { ImprovementAttachPicker } from "./improvement-attach-picker";

interface MeetingNoteImprovementsSectionProps {
  meetingNoteId: string;
  linkedImprovements: LinkedImprovementSummary[];
}

/**
 * "Improvements discussed" — many-to-many (a retro can revisit an
 * improvement across meetings), purely referential with no status
 * side-effect on the improvement itself (see docs/meetings.md). Unlinking
 * mirrors `ProjectLinkedIdeas`'s single-tap-with-undo pattern.
 */
export function MeetingNoteImprovementsSection({
  meetingNoteId,
  linkedImprovements,
}: MeetingNoteImprovementsSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleUnlink(improvement: LinkedImprovementSummary) {
    startTransition(async () => {
      const result = await unlinkImprovementFromMeetingNote(
        meetingNoteId,
        improvement.id
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast(`"${improvement.title}" unlinked`, {
        action: {
          label: "Undo",
          onClick: () => {
            startTransition(async () => {
              const undoResult = await linkImprovementToMeetingNote(
                meetingNoteId,
                improvement.id
              );
              if (undoResult.error) toast.error(undoResult.error);
            });
          },
        },
      });
    });
  }

  return (
    <section
      data-slot="meeting-note-improvements"
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-small font-semibold">Improvements discussed</h2>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => setPickerOpen(true)}
        >
          Link an improvement
        </Button>
      </div>

      {linkedImprovements.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          No improvements linked yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {linkedImprovements.map((improvement) => (
            <li
              key={improvement.id}
              className="flex items-center gap-2 rounded-md bg-background/70 px-2 py-1.5"
            >
              <span className="flex-1 truncate text-small">
                {improvement.title}
              </span>
              <Badge variant="secondary">
                {IMPROVEMENT_STATUS_LABEL[improvement.status]}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Unlink "${improvement.title}"`}
                disabled={pending}
                onClick={() => handleUnlink(improvement)}
              >
                <Unlink aria-hidden className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ImprovementAttachPicker
        meetingNoteId={meetingNoteId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </section>
  );
}
