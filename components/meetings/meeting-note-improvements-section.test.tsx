import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const unlinkImprovementFromMeetingNote = vi.hoisted(() => vi.fn());
const linkImprovementToMeetingNote = vi.hoisted(() => vi.fn());
vi.mock("@/lib/meetings/actions", () => ({
  unlinkImprovementFromMeetingNote,
  linkImprovementToMeetingNote,
  searchLinkableImprovements: vi.fn().mockResolvedValue([]),
}));

const toastFn = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(toastFn, { success: vi.fn(), error: vi.fn() }),
}));

import type { LinkedImprovementSummary } from "@/lib/data/meeting-notes";
import { MeetingNoteImprovementsSection } from "./meeting-note-improvements-section";

const improvement: LinkedImprovementSummary = {
  id: "i-1",
  title: "Automate the changelog",
  status: "proposed",
};

describe("MeetingNoteImprovementsSection", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty state when nothing is linked", () => {
    render(
      <MeetingNoteImprovementsSection
        meetingNoteId="m-1"
        linkedImprovements={[]}
      />
    );
    expect(screen.getByText("No improvements linked yet.")).toBeInTheDocument();
  });

  it("lists linked improvements with their status", () => {
    render(
      <MeetingNoteImprovementsSection
        meetingNoteId="m-1"
        linkedImprovements={[improvement]}
      />
    );
    expect(screen.getByText("Automate the changelog")).toBeInTheDocument();
    expect(screen.getByText("Proposed")).toBeInTheDocument();
  });

  it("unlinks an improvement with an undo toast", async () => {
    unlinkImprovementFromMeetingNote.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <MeetingNoteImprovementsSection
        meetingNoteId="m-1"
        linkedImprovements={[improvement]}
      />
    );

    await user.click(
      screen.getByRole("button", {
        name: 'Unlink "Automate the changelog"',
      })
    );

    await waitFor(() =>
      expect(unlinkImprovementFromMeetingNote).toHaveBeenCalledWith(
        "m-1",
        "i-1"
      )
    );
    expect(toastFn).toHaveBeenCalledWith(
      '"Automate the changelog" unlinked',
      expect.objectContaining({ action: expect.any(Object) })
    );
  });
});
