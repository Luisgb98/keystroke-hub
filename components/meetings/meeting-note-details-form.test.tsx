import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const updateMeetingNoteDetails = vi.hoisted(() => vi.fn());
vi.mock("@/lib/meetings/actions", () => ({ updateMeetingNoteDetails }));

import type { MeetingNoteWithLinks } from "@/lib/data/meeting-notes";
import { MeetingNoteDetailsForm } from "./meeting-note-details-form";

const meetingNote: MeetingNoteWithLinks = {
  id: "m-1",
  date: "2026-07-12",
  title: "Weekly sync",
  meetingType: "standup",
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

describe("MeetingNoteDetailsForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders every editable field pre-filled", () => {
    render(<MeetingNoteDetailsForm meetingNote={meetingNote} projects={[]} />);
    expect(screen.getByLabelText("Date")).toHaveValue("2026-07-12");
    expect(screen.getByLabelText("Title")).toHaveValue("Weekly sync");
    expect(screen.getByLabelText("Notes")).toHaveValue(
      "Discussed the roadmap."
    );
  });

  it("renders a markdown preview of the notes when the Preview tab is selected", async () => {
    const user = userEvent.setup();
    render(<MeetingNoteDetailsForm meetingNote={meetingNote} projects={[]} />);

    await user.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.queryByLabelText("Notes")).not.toBeInTheDocument();
    expect(screen.getByText("Discussed the roadmap.")).toBeInTheDocument();
  });

  it("does not show a project select when there are no linkable projects", () => {
    render(<MeetingNoteDetailsForm meetingNote={meetingNote} projects={[]} />);
    expect(screen.queryByText("Related project")).not.toBeInTheDocument();
  });

  it("shows a project select when linkable projects exist", () => {
    render(
      <MeetingNoteDetailsForm
        meetingNote={meetingNote}
        projects={[{ id: "p-1", name: "Keystroke Hub" }]}
      />
    );
    expect(screen.getByText("Related project")).toBeInTheDocument();
  });

  it("submits the edited fields", async () => {
    updateMeetingNoteDetails.mockResolvedValue({
      success: true,
      meetingNoteId: "m-1",
    });
    const user = userEvent.setup();
    render(<MeetingNoteDetailsForm meetingNote={meetingNote} projects={[]} />);

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Renamed sync");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateMeetingNoteDetails).toHaveBeenCalledTimes(1)
    );
    const [, formData] = updateMeetingNoteDetails.mock.calls[0] as [
      unknown,
      FormData,
    ];
    expect(formData.get("id")).toBe("m-1");
    expect(formData.get("title")).toBe("Renamed sync");
  });

  it("shows a field error on invalid input", async () => {
    updateMeetingNoteDetails.mockResolvedValue({
      error: "Check the highlighted fields.",
      fieldErrors: { title: ["Title is required"] },
    });
    const user = userEvent.setup();
    render(<MeetingNoteDetailsForm meetingNote={meetingNote} projects={[]} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
  });
});
