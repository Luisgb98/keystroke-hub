import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MeetingNoteDetailHeader } from "@/components/meetings/meeting-note-detail-header";
import { MeetingNoteDetailsForm } from "@/components/meetings/meeting-note-details-form";
import { MeetingNoteEventSection } from "@/components/meetings/meeting-note-event-section";
import { MeetingNoteImprovementsSection } from "@/components/meetings/meeting-note-improvements-section";
import { GithubIssueLinkSection } from "@/components/shared/github-issue-link-section";
import { listLinkableProjects } from "@/lib/data/improvements";
import { listGithubIssueLinksForMeetingNote } from "@/lib/data/github-links";
import { getMeetingNote } from "@/lib/data/meeting-notes";

export const metadata: Metadata = {
  title: "Meeting note",
};

interface MeetingNoteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MeetingNoteDetailPage({
  params,
}: MeetingNoteDetailPageProps) {
  const { id } = await params;
  const meetingNote = await getMeetingNote(id);
  if (!meetingNote) notFound();

  const projects = await listLinkableProjects();
  const githubIssueLinks = await listGithubIssueLinksForMeetingNote(
    meetingNote.id
  );

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:mx-auto sm:w-full sm:max-w-2xl sm:px-10 sm:py-8">
      <MeetingNoteDetailHeader meetingNote={meetingNote} />

      <MeetingNoteDetailsForm meetingNote={meetingNote} projects={projects} />

      <MeetingNoteEventSection
        meetingNoteId={meetingNote.id}
        event={meetingNote.event}
      />

      <MeetingNoteImprovementsSection
        meetingNoteId={meetingNote.id}
        linkedImprovements={meetingNote.linkedImprovements}
      />

      <GithubIssueLinkSection
        target={{ type: "meetingNote", id: meetingNote.id }}
        links={githubIssueLinks}
      />
    </div>
  );
}
