import type { Metadata } from "next";

import { MeetingNoteCapture } from "@/components/meetings/meeting-note-capture";
import { MeetingNoteCard } from "@/components/meetings/meeting-note-card";
import { MeetingSearch } from "@/components/meetings/meeting-search";
import {
  listLinkableProjects,
  type LinkableProjectOption,
} from "@/lib/data/improvements";
import {
  listMeetingNotes,
  type MeetingNoteSummary,
} from "@/lib/data/meeting-notes";

export const metadata: Metadata = {
  title: "Meeting notes",
};

interface MeetingsPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function MeetingsPage({
  searchParams,
}: MeetingsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || "";

  // Renders even if the database is unreachable — same resilience contract
  // as /projects (see docs/database.md).
  let meetingNotes: MeetingNoteSummary[] = [];
  let projects: LinkableProjectOption[] = [];
  try {
    [meetingNotes, projects] = await Promise.all([
      listMeetingNotes(q),
      listLinkableProjects(),
    ]);
  } catch (error) {
    console.error("Failed to load meeting notes:", error);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-10 sm:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-h1 font-semibold">Meeting notes</h1>
        <p className="text-small text-muted-foreground">
          What got discussed, and how it went — searchable, and linkable to
          projects, calendar events, and the improvements backlog.
        </p>
      </div>

      <MeetingNoteCapture projects={projects} />

      <MeetingSearch value={q} />

      {meetingNotes.length === 0 ? (
        <p className="py-10 text-center text-small text-muted-foreground">
          {q
            ? "No meeting notes match your search."
            : "No meeting notes yet — add one above to get started."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meetingNotes.map((meetingNote) => (
            <MeetingNoteCard key={meetingNote.id} meetingNote={meetingNote} />
          ))}
        </div>
      )}
    </div>
  );
}
