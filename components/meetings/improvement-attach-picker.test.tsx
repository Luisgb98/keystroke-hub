import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const linkImprovementToMeetingNote = vi.hoisted(() => vi.fn());
const searchLinkableImprovements = vi.hoisted(() => vi.fn());
vi.mock("@/lib/meetings/actions", () => ({
  linkImprovementToMeetingNote,
  searchLinkableImprovements,
}));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: toastError }),
}));

import type { LinkableImprovement } from "@/lib/data/meeting-notes";
import { ImprovementAttachPicker } from "./improvement-attach-picker";

const improvements: LinkableImprovement[] = [
  { id: "i-1", title: "Automate the changelog", status: "proposed" },
];

describe("ImprovementAttachPicker", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when closed", () => {
    searchLinkableImprovements.mockResolvedValue(improvements);
    render(
      <ImprovementAttachPicker
        meetingNoteId="m-1"
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("loads and renders matching improvements when opened", async () => {
    searchLinkableImprovements.mockResolvedValue(improvements);
    render(
      <ImprovementAttachPicker
        meetingNoteId="m-1"
        open
        onOpenChange={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(searchLinkableImprovements).toHaveBeenCalledWith("m-1", "")
    );
    expect(
      await screen.findByText("Automate the changelog")
    ).toBeInTheDocument();
  });

  it("re-queries as the search text changes", async () => {
    searchLinkableImprovements.mockResolvedValue(improvements);
    const user = userEvent.setup();
    render(
      <ImprovementAttachPicker
        meetingNoteId="m-1"
        open
        onOpenChange={vi.fn()}
      />
    );
    await screen.findByText("Automate the changelog");

    await user.type(screen.getByLabelText("Search improvements"), "changelog");

    await waitFor(() =>
      expect(searchLinkableImprovements).toHaveBeenLastCalledWith(
        "m-1",
        "changelog"
      )
    );
  });

  it("shows a 'no more improvements' message for an empty result set", async () => {
    searchLinkableImprovements.mockResolvedValue([]);
    render(
      <ImprovementAttachPicker
        meetingNoteId="m-1"
        open
        onOpenChange={vi.fn()}
      />
    );
    expect(
      await screen.findByText("No more improvements to link.")
    ).toBeInTheDocument();
  });

  it("links the selected improvement and closes the picker", async () => {
    searchLinkableImprovements.mockResolvedValue(improvements);
    linkImprovementToMeetingNote.mockResolvedValue({});
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ImprovementAttachPicker
        meetingNoteId="m-1"
        open
        onOpenChange={onOpenChange}
      />
    );
    await screen.findByText("Automate the changelog");

    await user.click(screen.getByText("Automate the changelog"));

    await waitFor(() =>
      expect(linkImprovementToMeetingNote).toHaveBeenCalledWith("m-1", "i-1")
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toastSuccess).toHaveBeenCalledWith(
      '"Automate the changelog" linked'
    );
  });

  it("toasts an error and keeps the picker open when linking fails", async () => {
    searchLinkableImprovements.mockResolvedValue(improvements);
    linkImprovementToMeetingNote.mockResolvedValue({
      error: "That improvement no longer exists.",
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ImprovementAttachPicker
        meetingNoteId="m-1"
        open
        onOpenChange={onOpenChange}
      />
    );
    await screen.findByText("Automate the changelog");

    await user.click(screen.getByText("Automate the changelog"));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "That improvement no longer exists."
      )
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
