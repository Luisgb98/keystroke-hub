import Link from "next/link";
import { format } from "date-fns";
import { Briefcase, CalendarClock } from "lucide-react";

import { PUBLISHING_TAG_STANDARD } from "@/lib/content/idea-schema";
import type { Idea, Script } from "@/lib/db/schema";
import type { ScheduledEventSummary } from "@/lib/data/idea-event-links";
import type { LinkedProjectSummary } from "@/lib/data/projects";
import { Badge } from "@/components/ui/badge";

import { IdeaCopyActions } from "../idea-copy-actions";
import { IdeaScheduledEvents } from "../idea-scheduled-events";
import { IdeaStatusSelect } from "../idea-status-select";
import { IdeaDetailHeader } from "./idea-detail-header";
import { IdeaScriptSection } from "./idea-script-section";

interface IdeaDetailProps {
  idea: Idea;
  script: Script | null;
  scheduledEvents: ScheduledEventSummary[];
  project?: LinkedProjectSummary;
}

/**
 * The idea detail page body (#73): everything about an idea on one finished
 * page — title, description (paragraph breaks preserved), tags, format,
 * status, release date/time, linked calendar events and project, the four
 * publish copy blocks, and the script rendered read-only with an explicit
 * edit. A presentational server component composing the interactive client
 * pieces (`IdeaDetailHeader`, `IdeaStatusSelect`, `IdeaCopyActions`,
 * `IdeaScheduledEvents`, `IdeaScriptSection`).
 */
export function IdeaDetail({
  idea,
  script,
  scheduledEvents,
  project,
}: IdeaDetailProps) {
  const hasScript = Boolean(script && script.content.trim() !== "");
  // The release is the linked event the idea points at — the source of truth
  // for its date/time (see docs/content-ideas.md).
  const releaseEvent = idea.releaseEventId
    ? scheduledEvents.find((event) => event.id === idea.releaseEventId)
    : undefined;
  const tagsIncomplete = idea.tags.length !== PUBLISHING_TAG_STANDARD;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:mx-auto sm:w-full sm:max-w-2xl sm:px-10 sm:py-8">
      <IdeaDetailHeader
        idea={idea}
        releaseStartsAt={releaseEvent?.startsAt ?? null}
        hasScript={hasScript}
        hasScheduledEvents={scheduledEvents.length > 0}
      />

      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-h1 font-semibold">{idea.title}</h1>

        <div className="flex flex-wrap items-center gap-3">
          <IdeaStatusSelect
            ideaId={idea.id}
            status={idea.status}
            size="default"
          />
          {releaseEvent ? (
            <span className="flex items-center gap-1.5 text-small text-muted-foreground">
              <CalendarClock aria-hidden className="size-4 shrink-0" />
              {releaseEvent.allDay
                ? format(releaseEvent.startsAt, "MMM d, yyyy")
                : format(releaseEvent.startsAt, "MMM d, yyyy · HH:mm")}
            </span>
          ) : null}
        </div>

        {idea.notes ? (
          <p className="text-body whitespace-pre-line">{idea.notes}</p>
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
            className="flex w-fit items-center gap-1.5 text-small text-muted-foreground hover:underline"
          >
            <Briefcase aria-hidden className="size-4 shrink-0" />
            {project.name}
          </Link>
        ) : null}

        <IdeaScheduledEvents
          ideaId={idea.id}
          scheduledEvents={scheduledEvents}
        />
      </div>

      <IdeaScriptSection ideaId={idea.id} script={script} />
    </div>
  );
}
