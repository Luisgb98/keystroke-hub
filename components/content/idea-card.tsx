"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Briefcase, Pencil, ScrollText, Trash2 } from "lucide-react";

import { IDEA_FORMAT_LABEL } from "@/lib/content/idea-format";
import { PUBLISHING_TAG_STANDARD } from "@/lib/content/idea-schema";
import type { Idea } from "@/lib/db/schema";
import type { ScheduledEventSummary } from "@/lib/data/idea-event-links";
import type { LinkedProjectSummary } from "@/lib/data/projects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { DeleteIdeaDialog } from "./delete-idea-dialog";
import { IdeaCopyActions } from "./idea-copy-actions";
import { IdeaEditor } from "./idea-editor";
import { IDEA_FORMAT_ICON } from "./idea-format-styles";
import { IdeaScheduledEvents } from "./idea-scheduled-events";
import { IdeaStatusSelect } from "./idea-status-select";

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
 * The title is a stretched link to the idea's detail page (#73): the whole
 * card is the click target, while each interactive control opts back out with
 * `relative z-10` so it stays independently clickable.
 *
 * Every field is editable after capture via the pencil (issue #71) — it opens
 * the shared `IdeaEditor`. Status still commits inline (no confirmation; cheap
 * to change back) via the shared `IdeaStatusSelect` (#73 extracted it so the
 * detail page shares one implementation) — a themed shadcn `Select` (#72)
 * rather than a native `<select>`, so its trigger and option popup follow the
 * app theme in both modes.
 */
export function IdeaCard({
  idea,
  hasScript = false,
  scheduledEvents = [],
  project,
}: IdeaCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const Icon = IDEA_FORMAT_ICON[idea.format];

  // The release is one of the linked events — the one the idea points at.
  const releaseEvent = idea.releaseEventId
    ? scheduledEvents.find((event) => event.id === idea.releaseEventId)
    : undefined;
  const tagsIncomplete = idea.tags.length !== PUBLISHING_TAG_STANDARD;

  return (
    <>
      {/* `relative` anchors the title's stretched link (#73): the whole card
          navigates to the detail page, while the interactive controls below
          opt back out with `relative z-10` so they stay clickable. */}
      <Card data-slot="idea-card" className="relative h-full">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <Icon aria-hidden className="size-4 shrink-0" />
            <span>{IDEA_FORMAT_LABEL[idea.format]}</span>
          </div>
          <div className="relative z-10 flex items-center gap-1">
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
            <Link
              href={`/content/ideas/${idea.id}`}
              className="after:absolute after:inset-0 after:content-[''] hover:underline"
            >
              {idea.title}
            </Link>
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

          <div className="relative z-10">
            <IdeaCopyActions idea={idea} />
          </div>

          {project ? (
            <Link
              href={`/projects/${project.id}`}
              className="relative z-10 flex w-fit items-center gap-1 text-caption text-muted-foreground hover:underline"
            >
              <Briefcase aria-hidden className="size-3.5 shrink-0" />
              {project.name}
            </Link>
          ) : null}

          <div className="relative z-10 empty:hidden">
            <IdeaScheduledEvents
              ideaId={idea.id}
              scheduledEvents={scheduledEvents}
            />
          </div>

          <div className="relative z-10 mt-auto flex items-center justify-between gap-2 pt-1">
            <IdeaStatusSelect ideaId={idea.id} status={idea.status} />
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
