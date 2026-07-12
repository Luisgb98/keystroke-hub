import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const deleteMeetingNote = vi.hoisted(() => vi.fn());
vi.mock("@/lib/meetings/actions", () => ({ deleteMeetingNote }));

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: toastError }),
}));

import type { MeetingNoteWithLinks } from "@/lib/data/meeting-notes";
import { DeleteMeetingNoteDialog } from "./delete-meeting-note-dialog";

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

describe("DeleteMeetingNoteDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when closed", () => {
    render(
      <DeleteMeetingNoteDialog
        meetingNote={meetingNote}
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("deletes and navigates back to the list on confirm", async () => {
    deleteMeetingNote.mockResolvedValue({});
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DeleteMeetingNoteDialog
        meetingNote={meetingNote}
        open
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteMeetingNote).toHaveBeenCalledWith("m-1"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(push).toHaveBeenCalledWith("/projects/meetings");
    expect(toastSuccess).toHaveBeenCalledWith('"Weekly sync" deleted');
  });

  it("toasts an error and keeps the dialog result without navigating on failure", async () => {
    deleteMeetingNote.mockResolvedValue({
      error: "That meeting note no longer exists.",
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DeleteMeetingNoteDialog
        meetingNote={meetingNote}
        open
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "That meeting note no longer exists."
      )
    );
    expect(push).not.toHaveBeenCalled();
  });
});
