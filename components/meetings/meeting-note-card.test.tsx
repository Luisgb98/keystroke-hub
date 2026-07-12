import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MeetingNoteSummary } from "@/lib/data/meeting-notes";

import { MeetingNoteCard } from "./meeting-note-card";

function meetingNote(
  overrides: Partial<MeetingNoteSummary> = {}
): MeetingNoteSummary {
  return {
    id: "m-1",
    date: "2026-07-12",
    title: "Weekly sync",
    meetingType: "standup",
    reflection: null,
    projectId: null,
    projectName: null,
    eventId: null,
    linkedImprovementCount: 0,
    createdAt: new Date("2026-07-12T09:00:00Z"),
    updatedAt: new Date("2026-07-12T09:00:00Z"),
    ...overrides,
  };
}

describe("MeetingNoteCard", () => {
  it("renders the title, date, and type badge", () => {
    render(<MeetingNoteCard meetingNote={meetingNote()} />);
    expect(screen.getByText("Weekly sync")).toBeInTheDocument();
    expect(screen.getByText("Jul 12, 2026")).toBeInTheDocument();
    expect(screen.getByText("Standup")).toBeInTheDocument();
  });

  it("links to the detail page", () => {
    render(<MeetingNoteCard meetingNote={meetingNote()} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/projects/meetings/m-1"
    );
  });

  it("shows a reflection snippet when present", () => {
    render(
      <MeetingNoteCard
        meetingNote={meetingNote({ reflection: "Went really well" })}
      />
    );
    expect(screen.getByText("Went really well")).toBeInTheDocument();
  });

  it("shows a project chip when linked", () => {
    render(
      <MeetingNoteCard
        meetingNote={meetingNote({
          projectId: "p-1",
          projectName: "Keystroke Hub",
        })}
      />
    );
    expect(screen.getByText("Keystroke Hub")).toBeInTheDocument();
  });

  it("shows a scheduled chip when linked to an event", () => {
    render(<MeetingNoteCard meetingNote={meetingNote({ eventId: "e-1" })} />);
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
  });

  it("shows the linked improvement count when present", () => {
    render(
      <MeetingNoteCard
        meetingNote={meetingNote({ linkedImprovementCount: 3 })}
      />
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
