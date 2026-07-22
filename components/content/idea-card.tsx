"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Briefcase, Pencil, ScrollText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { updateIdeaStatus } from "@/lib/content/actions";
import { IDEA_FORMAT_LABEL } from "@/lib/content/idea-format";
import { PUBLISHING_TAG_STANDARD } from "@/lib/content/idea-schema";
import {
  IDEA_STATUSES,
  IDEA_STATUS_LABEL,
  isIdeaStatus,
} from "@/lib/content/idea-status";
import type { Idea } from "@/lib/db/schema";
import type { ScheduledEventSummary } from "@/lib/data/idea-event-links";
import type { LinkedProjectSummary } from "@/lib/data/projects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { DeleteIdeaDialog } from "./delete-idea-dialog";
import { IdeaCopyActions } from "./idea-copy-actions";
import { IdeaEditor } from "./idea-editor";
import { IDEA_FORMAT_ICON } from "./idea-format-styles";
import { IdeaScheduledEvents } from "./idea-scheduled-events";

interface IdeaCardProps {
  idea: Idea;
  /** Whether a non-empty script is already saved for this idea (see docs/scripts.md). */
  hasScript?: boolean;
  /** Content-track events this idea is linked to, chronological (see docs/content-links.md). */
  scheduledEvents?: ScheduledEventSummary[];
  /** The project this idea belongs to, if any — read-only here; linking happens from the project page (see docs/projects.md). */
  project?: LinkedProjectSummary;
}

/**
 * A uniform, publish-ready card (#72): every card is the same height regardless
 * of description length (the grid's `auto-rows-fr` + `h-full` here, with the
 * description clamped and line breaks preserved via `whitespace-pre-line`), and
 * `IdeaCopyActions` hands over the four one-click publish blocks.
 *
 * Every field is editable after capture via the pencil (issue #71) — it opens
 * the shared `IdeaEditor`. Status still commits inline (no confirmation; cheap
 * to change back), sharing `updateIdeaStatus` with the board's move menu (see
 * docs/content-ideas.md); #72 moved it from a native `<select>` to the themed
 * shadcn `Select` so its trigger and option popup follow the app theme in both
 * modes rather than relying on the browser default.
 */
export function IdeaCard({
  idea,
  hasScript = false,
  scheduledEvents = [],
  project,
}: IdeaCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const Icon = IDEA_FORMAT_ICON[idea.format];

  // The release is one of the linked events — the one the idea points at.
  const releaseEvent = idea.releaseEventId
    ? scheduledEvents.find((event) => event.id === idea.releaseEventId)
    : undefined;
  const tagsIncomplete = idea.tags.length !== PUBLISHING_TAG_STANDARD;

  function handleStatusChange(status: string) {
    startTransition(async () => {
      const result = await updateIdeaStatus(idea.id, status);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      // No chip/dialog on this surface (the board card owns that — see
      // docs/content-ideas.md), so the nudge here is a plain message.
      if (status === "published" && (result.uncheckedCount ?? 0) > 0) {
        const count = result.uncheckedCount ?? 0;
        toast(
          `Published with ${count} unchecked checklist item${count === 1 ? "" : "s"}`
        );
      }
    });
  }

  return (
    <>
      <Card data-slot="idea-card" className="h-full">
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
              aria-label={`Edit "${idea.title}"`}
              onClick={() => setEditOpen(true)}
            >
              <Pencil aria-hidden className="size-4" />
            </Button>
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
        <CardContent className="flex flex-1 flex-col gap-3">
          <h3 className="line-clamp-2 font-heading text-h3 font-semibold">
            {idea.title}
          </h3>
          {idea.notes ? (
            <p className="line-clamp-3 text-small whitespace-pre-line text-muted-foreground">
              {idea.notes}
            </p>
          ) : null}

          {idea.tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {idea.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="font-mono">
                  {tag}
                </Badge>
              ))}
              {tagsIncomplete ? (
                <span className="font-mono text-caption text-muted-foreground">
                  {idea.tags.length}/{PUBLISHING_TAG_STANDARD}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="font-mono text-caption text-muted-foreground">
              No tags yet — the standard is {PUBLISHING_TAG_STANDARD}.
            </span>
          )}

          <IdeaCopyActions idea={idea} />

          {project ? (
            <Link
              href={`/projects/${project.id}`}
              className="flex w-fit items-center gap-1 text-caption text-muted-foreground hover:underline"
            >
              <Briefcase aria-hidden className="size-3.5 shrink-0" />
              {project.name}
            </Link>
          ) : null}

          <IdeaScheduledEvents
            ideaId={idea.id}
            scheduledEvents={scheduledEvents}
          />

          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <Select
              value={idea.status}
              onValueChange={(value) => {
                if (value) handleStatusChange(value);
              }}
              disabled={pending}
            >
              <SelectTrigger aria-label="Status" size="sm">
                <SelectValue>
                  {(value) =>
                    isIdeaStatus(value) ? IDEA_STATUS_LABEL[value] : null
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {IDEA_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {IDEA_STATUS_LABEL[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-caption text-muted-foreground">
              {formatDistanceToNow(idea.createdAt, { addSuffix: true })}
            </span>
          </div>
        </CardContent>
      </Card>

      <IdeaEditor
        mode="edit"
        idea={idea}
        releaseStartsAt={releaseEvent?.startsAt ?? null}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <DeleteIdeaDialog
        idea={idea}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        hasScheduledEvents={scheduledEvents.length > 0}
        hasScript={hasScript}
      />
    </>
  );
}
