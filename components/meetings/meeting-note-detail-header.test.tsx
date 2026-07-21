import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/meetings/actions", () => ({ deleteMeetingNote: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import type { MeetingNoteWithLinks } from "@/lib/data/meeting-notes";
import { MeetingNoteDetailHeader } from "./meeting-note-detail-header";

const meetingNote: MeetingNoteWithLinks = {
  id: "m-1",
  date: "2026-07-12",
  title: "Weekly sync",
  meetingType: "planning",
  notes: "Discussed the roadmap.",
  reflection: null,
  projectId: null,
  projectName: null,
  eventId: null,
  createdAt: new Date("2026-07-12T09:00:00Z"),
  updatedAt: new Date("2026-07-12T09:00:00Z"),
  event: null,
  linkedImprovements: [],
};

describe("MeetingNoteDetailHeader", () => {
  it("shows the work-track marker and type badge", () => {
    render(<MeetingNoteDetailHeader meetingNote={meetingNote} />);
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Planning")).toBeInTheDocument();
  });

  it("opens the delete confirmation dialog", async () => {
    const user = userEvent.setup();
    render(<MeetingNoteDetailHeader meetingNote={meetingNote} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("Delete this meeting note?")).toBeInTheDocument();
  });
});
