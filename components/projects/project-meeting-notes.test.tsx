import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MeetingNoteSummaryForProject } from "@/lib/data/meeting-notes";

import { ProjectMeetingNotes } from "./project-meeting-notes";

describe("ProjectMeetingNotes", () => {
  it("shows an empty state when nothing is linked", () => {
    render(<ProjectMeetingNotes meetingNotes={[]} />);
    expect(
      screen.getByText("No meeting notes linked yet.")
    ).toBeInTheDocument();
  });

  it("lists linked meeting notes, each pointing at its detail page", () => {
    const meetingNotes: MeetingNoteSummaryForProject[] = [
      { id: "m-1", date: "2026-07-12", title: "Weekly sync" },
    ];
    render(<ProjectMeetingNotes meetingNotes={meetingNotes} />);
    const link = screen.getByRole("link", { name: /Weekly sync/ });
    expect(link).toHaveAttribute("href", "/projects/meetings/m-1");
  });

  it("links to the full list", () => {
    render(<ProjectMeetingNotes meetingNotes={[]} />);
    expect(screen.getByRole("link", { name: "Open all" })).toHaveAttribute(
      "href",
      "/projects/meetings"
    );
  });
});
