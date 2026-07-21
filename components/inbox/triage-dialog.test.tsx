import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const triageEntry = vi.hoisted(() => vi.fn());
vi.mock("@/lib/inbox/actions", () => ({ triageEntry }));

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess }),
}));

import { TriageDialog } from "./triage-dialog";

const baseProps = {
  entryId: "entry-1",
  today: "2026-07-18",
  open: true,
  onOpenChange: vi.fn(),
  onTriaged: vi.fn(),
};

describe("TriageDialog", () => {
  afterEach(() => vi.clearAllMocks());

  it("prefills the idea title from the captured body's first line", () => {
    render(
      <TriageDialog
        {...baseProps}
        destination="content_idea"
        body={"Retro video\ncover the highlights"}
      />
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Retro video");
    expect(screen.getByLabelText("Notes")).toHaveValue("cover the highlights");
  });

  it("triages an idea and closes on success", async () => {
    triageEntry.mockResolvedValue({ success: true, destinationId: "idea-1" });
    const onOpenChange = vi.fn();
    const onTriaged = vi.fn();
    const user = userEvent.setup();
    render(
      <TriageDialog
        {...baseProps}
        onOpenChange={onOpenChange}
        onTriaged={onTriaged}
        destination="content_idea"
        body="Retro video"
      />
    );

    await user.click(screen.getByRole("button", { name: /Send to/ }));

    await waitFor(() =>
      expect(triageEntry).toHaveBeenCalledWith("entry-1", {
        type: "content_idea",
        title: "Retro video",
        notes: "",
      })
    );
    expect(toastSuccess).toHaveBeenCalledWith("Sent to Content idea");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onTriaged).toHaveBeenCalled();
  });

  it("shows a date field and an empty title for a meeting note", () => {
    render(
      <TriageDialog
        {...baseProps}
        destination="meeting_note"
        body="sync notes"
      />
    );
    expect(screen.getByLabelText("Date")).toHaveValue("2026-07-18");
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByLabelText("Notes")).toHaveValue("sync notes");
  });

  it("surfaces the action error and stays open", async () => {
    triageEntry.mockResolvedValue({ error: "That entry was already triaged." });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TriageDialog
        {...baseProps}
        onOpenChange={onOpenChange}
        destination="daily_log_item"
        body="call the plumber"
      />
    );

    await user.click(screen.getByRole("button", { name: /Send to/ }));

    expect(
      await screen.findByText("That entry was already triaged.")
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
