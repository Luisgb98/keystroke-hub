"use client";

import { linkIdeaToProject, searchLinkableIdeas } from "@/lib/projects/actions";
import { IDEA_FORMAT_LABEL } from "@/lib/content/idea-format";
import { IDEA_STATUS_LABEL } from "@/lib/content/idea-status";
import type { LinkableIdea } from "@/lib/data/projects";
import { Badge } from "@/components/ui/badge";
import { AttachPicker } from "@/components/shared/attach-picker";

interface IdeaAttachPickerProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Searchable picker for `ProjectLinkedIdeas` — only unassigned ideas show up
 * (see `searchLinkableIdeas` in `lib/data/projects.ts`).
 */
export function IdeaAttachPicker({
  projectId,
  open,
  onOpenChange,
}: IdeaAttachPickerProps) {
  return (
    <AttachPicker<LinkableIdea>
      open={open}
      onOpenChange={onOpenChange}
      title="Link an idea"
      description="Search unassigned ideas and attach one to this project."
      searchPlaceholder="Search ideas…"
      searchAriaLabel="Search ideas"
      search={(query) => searchLinkableIdeas(query)}
      attach={(idea) => linkIdeaToProject(projectId, idea.id)}
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
      emptyWithoutQuery="No unassigned ideas left."
    />
  );
}
