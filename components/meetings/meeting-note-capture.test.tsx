import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const createMeetingNote = vi.hoisted(() => vi.fn());
vi.mock("@/lib/meetings/actions", () => ({ createMeetingNote }));

import { MeetingNoteCapture } from "./meeting-note-capture";

describe("MeetingNoteCapture", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders date, title, and notes fields always visible", () => {
    render(<MeetingNoteCapture projects={[]} />);
    expect(screen.getByLabelText("Date")).toBeInTheDocument();
    expect(screen.getByLabelText("New meeting note")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    expect(screen.queryByText("Type")).not.toBeInTheDocument();
  });

  it("expands to show type and reflection once the user starts typing a title", async () => {
    const user = userEvent.setup();
    render(<MeetingNoteCapture projects={[]} />);

    await user.type(screen.getByLabelText("New meeting note"), "A");

    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(
      screen.getByLabelText("How did it go? (optional)")
    ).toBeInTheDocument();
  });

  it("does not show a project select when there are no linkable projects", async () => {
    const user = userEvent.setup();
    render(<MeetingNoteCapture projects={[]} />);
    await user.type(screen.getByLabelText("New meeting note"), "A");
    expect(
      screen.queryByText("Related project (optional)")
    ).not.toBeInTheDocument();
  });

  it("shows a project select when linkable projects exist", async () => {
    const user = userEvent.setup();
    render(
      <MeetingNoteCapture projects={[{ id: "p-1", name: "Keystroke Hub" }]} />
    );
    await user.type(screen.getByLabelText("New meeting note"), "A");
    expect(screen.getByText("Related project (optional)")).toBeInTheDocument();
  });

  it("submits date, title, and notes", async () => {
    createMeetingNote.mockResolvedValue({
      success: true,
      meetingNoteId: "m-1",
    });
    const user = userEvent.setup();
    render(<MeetingNoteCapture projects={[]} />);

    await user.type(screen.getByLabelText("New meeting note"), "Weekly sync");
    await user.type(screen.getByLabelText("Notes"), "Discussed the roadmap.");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(createMeetingNote).toHaveBeenCalledTimes(1));
    const [, formData] = createMeetingNote.mock.calls[0] as [unknown, FormData];
    expect(formData.get("title")).toBe("Weekly sync");
    expect(formData.get("notes")).toBe("Discussed the roadmap.");
    expect(formData.get("projectId")).toBe("");
  });

  it("resets and collapses after a successful capture", async () => {
    createMeetingNote.mockResolvedValue({
      success: true,
      meetingNoteId: "m-1",
    });
    const user = userEvent.setup();
    render(<MeetingNoteCapture projects={[]} />);

    await user.type(screen.getByLabelText("New meeting note"), "Sync");
    await user.type(screen.getByLabelText("Notes"), "Notes here");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(screen.getByLabelText("New meeting note")).toHaveValue("")
    );
    expect(screen.queryByText("Type")).not.toBeInTheDocument();
  });

  it("shows a field error on invalid input", async () => {
    createMeetingNote.mockResolvedValue({
      error: "Check the highlighted fields.",
      fieldErrors: { title: ["Title is required"] },
    });
    const user = userEvent.setup();
    render(<MeetingNoteCapture projects={[]} />);

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
  });
});
