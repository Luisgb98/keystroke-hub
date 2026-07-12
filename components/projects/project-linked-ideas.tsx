"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Unlink } from "lucide-react";
import { toast } from "sonner";

import {
  linkIdeaToProject,
  unlinkIdeaFromProject,
} from "@/lib/projects/actions";
import { IDEA_STATUS_LABEL } from "@/lib/content/idea-status";
import type { LinkedIdeaSummary } from "@/lib/data/projects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { IdeaAttachPicker } from "./idea-attach-picker";

interface ProjectLinkedIdeasProps {
  projectId: string;
  linkedIdeas: LinkedIdeaSummary[];
  disabled?: boolean;
}

/**
 * "Linked" section on the project detail page — the first concrete linkable
 * entity (content ideas); improvements and meeting notes slot in as sibling
 * sections when #25/#26 land (see docs/projects.md). Unlinking is a single
 * tap with an undo toast, mirroring `EventLinkedIdeas`'s precedent — re-
 * linking is cheap and the mistake is low-stakes.
 */
export function ProjectLinkedIdeas({
  projectId,
  linkedIdeas,
  disabled = false,
}: ProjectLinkedIdeasProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleUnlink(idea: LinkedIdeaSummary) {
    startTransition(async () => {
      const result = await unlinkIdeaFromProject(projectId, idea.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast(`"${idea.title}" unlinked`, {
        action: {
          label: "Undo",
          onClick: () => {
            startTransition(async () => {
              const undoResult = await linkIdeaToProject(projectId, idea.id);
              if (undoResult.error) toast.error(undoResult.error);
            });
          },
        },
      });
    });
  }

  return (
    <section
      data-slot="project-linked-ideas"
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-small font-semibold">Content ideas</h2>
        {!disabled ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => setPickerOpen(true)}
          >
            Link an idea
          </Button>
        ) : null}
      </div>

      {linkedIdeas.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          No ideas linked yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {linkedIdeas.map((idea) => (
            <li
              key={idea.id}
              className="flex items-center gap-2 rounded-md bg-background/70 px-2 py-1.5"
            >
              <Link
                href={`/content/ideas?q=${encodeURIComponent(idea.title)}`}
                className="flex flex-1 items-center gap-2 overflow-hidden text-small hover:underline"
              >
                <span className="truncate">{idea.title}</span>
                <Badge variant="secondary" className="shrink-0">
                  {IDEA_STATUS_LABEL[idea.status]}
                </Badge>
              </Link>
              {!disabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Unlink "${idea.title}"`}
                  disabled={pending}
                  onClick={() => handleUnlink(idea)}
                >
                  <Unlink aria-hidden className="size-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <IdeaAttachPicker
        projectId={projectId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </section>
  );
}
