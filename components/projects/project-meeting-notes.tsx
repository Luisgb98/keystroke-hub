import Link from "next/link";
import { format } from "date-fns";

import type { MeetingNoteSummaryForProject } from "@/lib/data/meeting-notes";

interface ProjectMeetingNotesProps {
  meetingNotes: MeetingNoteSummaryForProject[];
}

/**
 * Read-only "linked" sibling section on the project detail page — the third
 * concrete linkable entity after `ProjectLinkedIdeas` and
 * `ProjectImprovements` (see docs/projects.md, docs/meetings.md). Editing
 * (and the project link itself) happens on the meeting note's own detail
 * page, not here — this is a summary with a way in.
 */
export function ProjectMeetingNotes({
  meetingNotes,
}: ProjectMeetingNotesProps) {
  return (
    <section
      data-slot="project-meeting-notes"
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-small font-semibold">Meeting notes</h2>
        <Link
          href="/projects/meetings"
          className="text-caption text-muted-foreground hover:underline"
        >
          Open all
        </Link>
      </div>

      {meetingNotes.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          No meeting notes linked yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {meetingNotes.map((meetingNote) => (
            <li
              key={meetingNote.id}
              className="flex items-center gap-2 rounded-md bg-background/70 px-2 py-1.5"
            >
              <Link
                href={`/projects/meetings/${meetingNote.id}`}
                className="flex flex-1 items-center gap-2 overflow-hidden text-small hover:underline"
              >
                <span className="font-mono text-caption text-muted-foreground">
                  {format(new Date(`${meetingNote.date}T00:00:00`), "MMM d")}
                </span>
                <span className="truncate">{meetingNote.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
