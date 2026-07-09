"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ScrollText, Unlink } from "lucide-react";
import { toast } from "sonner";

import {
  linkIdeaToEvent,
  unlinkIdeaFromEvent,
} from "@/lib/content/link-actions";
import { IDEA_STATUS_LABEL } from "@/lib/content/idea-status";
import type { LinkedIdeaSummary } from "@/lib/calendar/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { IdeaLinkPicker } from "./idea-link-picker";

interface EventLinkedIdeasProps {
  eventId: string;
  linkedIdeas: LinkedIdeaSummary[];
}

/**
 * "Linked content" section inside `EventEditor`'s edit mode — content-track
 * events only, mounted by the caller (see docs/content-links.md). Unlinking
 * is a single tap with an undo toast rather than a confirm dialog, since
 * re-linking is cheap and the mistake is low-stakes.
 */
export function EventLinkedIdeas({
  eventId,
  linkedIdeas,
}: EventLinkedIdeasProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleUnlink(idea: LinkedIdeaSummary) {
    startTransition(async () => {
      const result = await unlinkIdeaFromEvent(eventId, idea.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast(`"${idea.title}" unlinked`, {
        action: {
          label: "Undo",
          onClick: () => {
            startTransition(async () => {
              const undoResult = await linkIdeaToEvent(eventId, idea.id);
              if (undoResult.error) toast.error(undoResult.error);
            });
          },
        },
      });
    });
  }

  return (
    <div
      data-slot="event-linked-ideas"
      className="flex flex-col gap-2 rounded-lg border border-track-content-border bg-track-content/40 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-small font-semibold">Linked content</h3>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => setPickerOpen(true)}
        >
          Link an idea
        </Button>
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
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${idea.hasScript ? "Open" : "Write"} script for "${idea.title}"`}
                render={<Link href={`/content/ideas/${idea.id}/script`} />}
              >
                <ScrollText
                  aria-hidden
                  className={
                    idea.hasScript
                      ? "size-3.5 text-track-content-foreground"
                      : "size-3.5"
                  }
                />
              </Button>
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
            </li>
          ))}
        </ul>
      )}

      <IdeaLinkPicker
        eventId={eventId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </div>
  );
}
