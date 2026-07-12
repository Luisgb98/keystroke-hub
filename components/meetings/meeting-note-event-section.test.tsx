import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const detachEventFromMeetingNote = vi.hoisted(() => vi.fn());
vi.mock("@/lib/meetings/actions", () => ({
  detachEventFromMeetingNote,
  searchAttachableEvents: vi.fn().mockResolvedValue([]),
  attachEventToMeetingNote: vi.fn(),
}));

import type { LinkedEventSummary } from "@/lib/data/meeting-notes";
import { MeetingNoteEventSection } from "./meeting-note-event-section";

const event: LinkedEventSummary = {
  id: "e-1",
  title: "Team sync",
  startsAt: new Date("2026-07-12T09:00:00"),
  endsAt: new Date("2026-07-12T09:30:00"),
  allDay: false,
};

describe("MeetingNoteEventSection", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty state and attach button when no event is linked", () => {
    render(<MeetingNoteEventSection meetingNoteId="m-1" event={null} />);
    expect(screen.getByText("No event attached yet.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Attach an event" })
    ).toBeInTheDocument();
  });

  it("shows the linked event and no attach button when one is linked", () => {
    render(<MeetingNoteEventSection meetingNoteId="m-1" event={event} />);
    expect(screen.getByText("Team sync", { exact: false })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Attach an event" })
    ).not.toBeInTheDocument();
  });

  it("detaches the event", async () => {
    detachEventFromMeetingNote.mockResolvedValue({});
    const user = userEvent.setup();
    render(<MeetingNoteEventSection meetingNoteId="m-1" event={event} />);

    await user.click(screen.getByRole("button", { name: "Detach event" }));

    await waitFor(() =>
      expect(detachEventFromMeetingNote).toHaveBeenCalledWith("m-1")
    );
  });
});
