"use client";

import {
  linkIdeaToEvent,
  searchLinkableIdeas,
} from "@/lib/content/link-actions";
import { IDEA_FORMAT_LABEL } from "@/lib/content/idea-format";
import { IDEA_STATUS_LABEL } from "@/lib/content/idea-status";
import type { LinkableIdea } from "@/lib/data/idea-event-links";
import { Badge } from "@/components/ui/badge";
import { AttachPicker } from "@/components/shared/attach-picker";

interface IdeaLinkPickerProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Searchable idea picker for `EventLinkedIdeas` — links an idea to a content event. */
export function IdeaLinkPicker({
  eventId,
  open,
  onOpenChange,
}: IdeaLinkPickerProps) {
  return (
    <AttachPicker<LinkableIdea>
      open={open}
      onOpenChange={onOpenChange}
      title="Link an idea"
      description="Search your ideas and attach one to this event."
      searchPlaceholder="Search ideas…"
      searchAriaLabel="Search ideas"
      scopeKey={eventId}
      search={(query) => searchLinkableIdeas(eventId, query)}
      attach={(idea) => linkIdeaToEvent(eventId, idea.id)}
      getKey={(idea) => idea.id}
      getTitle={(idea) => idea.title}
      renderSubLabel={(idea) => (
        <span className="flex gap-1.5">
          <Badge variant="secondary">{IDEA_FORMAT_LABEL[idea.format]}</Badge>
          <Badge variant="outline">{IDEA_STATUS_LABEL[idea.status]}</Badge>
        </span>
      )}
      successMessage={(idea) => `"${idea.title}" linked`}
      emptyWithQuery="No matching ideas."
      emptyWithoutQuery="No ideas left to link."
    />
  );
}
