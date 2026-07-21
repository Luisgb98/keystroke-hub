import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const attachEventToMeetingNote = vi.hoisted(() => vi.fn());
const searchAttachableEvents = vi.hoisted(() => vi.fn());
vi.mock("@/lib/meetings/actions", () => ({
  attachEventToMeetingNote,
  searchAttachableEvents,
}));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: toastError }),
}));

import type { AttachableEvent } from "@/lib/data/meeting-notes";
import { MeetingEventAttachPicker } from "./meeting-event-attach-picker";

const events: AttachableEvent[] = [
  {
    id: "evt-1",
    title: "Team sync",
    startsAt: new Date("2026-08-01T09:00:00"),
    endsAt: new Date("2026-08-01T09:30:00"),
    allDay: false,
  },
];

describe("MeetingEventAttachPicker", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when closed", () => {
    searchAttachableEvents.mockResolvedValue(events);
    render(
      <MeetingEventAttachPicker
        meetingNoteId="m-1"
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("loads and renders matching events when opened", async () => {
    searchAttachableEvents.mockResolvedValue(events);
    render(
      <MeetingEventAttachPicker
        meetingNoteId="m-1"
        open
        onOpenChange={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(searchAttachableEvents).toHaveBeenCalledWith("")
    );
    expect(await screen.findByText("Team sync")).toBeInTheDocument();
  });

  it("shows a 'no events left' message for an empty result set", async () => {
    searchAttachableEvents.mockResolvedValue([]);
    render(
      <MeetingEventAttachPicker
        meetingNoteId="m-1"
        open
        onOpenChange={vi.fn()}
      />
    );
    expect(
      await screen.findByText("No events left to attach.")
    ).toBeInTheDocument();
  });

  it("attaches the selected event and closes the picker", async () => {
    searchAttachableEvents.mockResolvedValue(events);
    attachEventToMeetingNote.mockResolvedValue({});
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <MeetingEventAttachPicker
        meetingNoteId="m-1"
        open
        onOpenChange={onOpenChange}
      />
    );
    await screen.findByText("Team sync");

    await user.click(screen.getByText("Team sync"));

    await waitFor(() =>
      expect(attachEventToMeetingNote).toHaveBeenCalledWith("m-1", "evt-1")
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toastSuccess).toHaveBeenCalledWith('Attached to "Team sync"');
  });

  it("toasts an error and keeps the picker open when attaching fails", async () => {
    searchAttachableEvents.mockResolvedValue(events);
    attachEventToMeetingNote.mockResolvedValue({
      error: "That event is already attached to another meeting note.",
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <MeetingEventAttachPicker
        meetingNoteId="m-1"
        open
        onOpenChange={onOpenChange}
      />
    );
    await screen.findByText("Team sync");

    await user.click(screen.getByText("Team sync"));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "That event is already attached to another meeting note."
      )
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
