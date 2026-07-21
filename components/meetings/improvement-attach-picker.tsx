"use client";

import {
  linkImprovementToMeetingNote,
  searchLinkableImprovements,
} from "@/lib/meetings/actions";
import { IMPROVEMENT_STATUS_LABEL } from "@/lib/improvements/improvement-status";
import type { LinkableImprovement } from "@/lib/data/meeting-notes";
import { Badge } from "@/components/ui/badge";
import { AttachPicker } from "@/components/shared/attach-picker";

interface ImprovementAttachPickerProps {
  meetingNoteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Searchable improvement picker for `MeetingNoteImprovementsSection` —
 * excludes improvements already linked to this meeting note (see
 * `searchLinkableImprovements`).
 */
export function ImprovementAttachPicker({
  meetingNoteId,
  open,
  onOpenChange,
}: ImprovementAttachPickerProps) {
  return (
    <AttachPicker<LinkableImprovement>
      open={open}
      onOpenChange={onOpenChange}
      title="Link an improvement"
      description="Search the improvements backlog and attach one to this meeting note."
      searchPlaceholder="Search improvements…"
      searchAriaLabel="Search improvements"
      scopeKey={meetingNoteId}
      search={(query) => searchLinkableImprovements(meetingNoteId, query)}
      attach={(improvement) =>
        linkImprovementToMeetingNote(meetingNoteId, improvement.id)
      }
      getKey={(improvement) => improvement.id}
      getTitle={(improvement) => improvement.title}
      renderSubLabel={(improvement) => (
        <Badge variant="secondary">
          {IMPROVEMENT_STATUS_LABEL[improvement.status]}
        </Badge>
      )}
      successMessage={(improvement) => `"${improvement.title}" linked`}
      emptyWithQuery="No matching improvements."
      emptyWithoutQuery="No more improvements to link."
    />
  );
}
