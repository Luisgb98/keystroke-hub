"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ScrollText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { updateIdeaStatus } from "@/lib/content/actions";
import { IDEA_FORMAT_LABEL } from "@/lib/content/idea-format";
import { IDEA_STATUSES, IDEA_STATUS_LABEL } from "@/lib/content/idea-status";
import type { Idea } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { DeleteIdeaDialog } from "./delete-idea-dialog";
import { IDEA_FORMAT_ICON } from "./idea-format-styles";

interface IdeaCardProps {
  idea: Idea;
  /** Whether a non-empty script is already saved for this idea (see docs/scripts.md). */
  hasScript?: boolean;
}

/**
 * Status is the only field editable after capture (see docs/content-ideas.md
 * open question 2) — a plain `<select>` change commits immediately, no
 * confirmation needed since it's cheap to change back.
 */
export function IdeaCard({ idea, hasScript = false }: IdeaCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const Icon = IDEA_FORMAT_ICON[idea.format];

  function handleStatusChange(status: string) {
    startTransition(async () => {
      const result = await updateIdeaStatus(idea.id, status);
      if (result.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <Card data-slot="idea-card">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <Icon aria-hidden className="size-4 shrink-0" />
            <span>{IDEA_FORMAT_LABEL[idea.format]}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`${hasScript ? "Open" : "Write"} script for "${idea.title}"`}
              render={<Link href={`/content/ideas/${idea.id}/script`} />}
            >
              <ScrollText
                aria-hidden
                className={
                  hasScript ? "size-4 text-track-content-foreground" : "size-4"
                }
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Delete "${idea.title}"`}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 aria-hidden className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <h3 className="font-heading text-h3 font-semibold">{idea.title}</h3>
          {idea.notes ? (
            <p className="line-clamp-3 text-small text-muted-foreground">
              {idea.notes}
            </p>
          ) : null}

          {idea.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {idea.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="font-mono">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <label className="sr-only" htmlFor={`idea-status-${idea.id}`}>
              Status
            </label>
            <select
              id={`idea-status-${idea.id}`}
              value={idea.status}
              disabled={pending}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {IDEA_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {IDEA_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
            <span className="text-caption text-muted-foreground">
              {formatDistanceToNow(idea.createdAt, { addSuffix: true })}
            </span>
          </div>
        </CardContent>
      </Card>

      <DeleteIdeaDialog
        idea={idea}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        hasScript={hasScript}
      />
    </>
  );
}
