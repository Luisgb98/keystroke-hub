import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const saveRetroNotes = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/stream-actions", () => ({ saveRetroNotes }));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: toastError }),
}));

import { StreamRetroNotes } from "./stream-retro-notes";

describe("StreamRetroNotes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("prefills existing retro notes", () => {
    render(<StreamRetroNotes streamId="s-1" retroNotes="Went well" />);
    expect(screen.getByLabelText("How did it go?")).toHaveValue("Went well");
  });

  it("saves the current value", async () => {
    saveRetroNotes.mockResolvedValue({});
    const user = userEvent.setup();
    render(<StreamRetroNotes streamId="s-1" retroNotes={null} />);

    await user.type(screen.getByLabelText("How did it go?"), "Great energy");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(saveRetroNotes).toHaveBeenCalledWith("s-1", "Great energy")
    );
    expect(toastSuccess).toHaveBeenCalledWith("Saved");
  });

  it("toasts an error when saving fails", async () => {
    saveRetroNotes.mockResolvedValue({
      error: "That stream no longer exists.",
    });
    const user = userEvent.setup();
    render(<StreamRetroNotes streamId="s-1" retroNotes={null} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That stream no longer exists.")
    );
  });
});
