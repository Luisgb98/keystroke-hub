import Link from "next/link";
import { format } from "date-fns";
import { Briefcase, CalendarDays, Lightbulb } from "lucide-react";

import type { MeetingNoteSummary } from "@/lib/data/meeting-notes";
import { MEETING_TYPE_LABEL } from "@/lib/meetings/meeting-type";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface MeetingNoteCardProps {
  meetingNote: MeetingNoteSummary;
}

/**
 * List card for `/projects/meetings` — a work-track surface (`Briefcase`
 * icon + `track-work` tokens, per docs/design-system.md — meetings are
 * work-life content, unlike the track-agnostic `projects`/`improvements`
 * cards), mono date, type badge, reflection snippet, and chips for the
 * linked project/event/improvements (see docs/meetings.md).
 */
export function MeetingNoteCard({ meetingNote }: MeetingNoteCardProps) {
  return (
    <Link
      href={`/projects/meetings/${meetingNote.id}`}
      className="block"
      data-slot="meeting-note-card"
    >
      <Card className="h-full border-track-work-border transition-colors hover:bg-track-work/40">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <Briefcase aria-hidden className="size-4 shrink-0" />
            <span className="font-mono">
              {format(new Date(`${meetingNote.date}T00:00:00`), "MMM d, yyyy")}
            </span>
          </div>
          <Badge variant="secondary">
            {MEETING_TYPE_LABEL[meetingNote.meetingType]}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <h3 className="font-heading text-h3 font-semibold">
            {meetingNote.title}
          </h3>
          {meetingNote.reflection ? (
            <p className="line-clamp-2 text-small text-muted-foreground">
              {meetingNote.reflection}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5">
            {meetingNote.projectId ? (
              <Badge variant="outline" className="gap-1">
                <Briefcase aria-hidden className="size-3" />
                {meetingNote.projectName}
              </Badge>
            ) : null}
            {meetingNote.eventId ? (
              <Badge variant="outline" className="gap-1">
                <CalendarDays aria-hidden className="size-3" />
                Scheduled
              </Badge>
            ) : null}
            {meetingNote.linkedImprovementCount > 0 ? (
              <Badge variant="outline" className="gap-1">
                <Lightbulb aria-hidden className="size-3" />
                {meetingNote.linkedImprovementCount}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
