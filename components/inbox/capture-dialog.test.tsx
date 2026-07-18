import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const captureEntry = vi.hoisted(() => vi.fn());
vi.mock("@/lib/inbox/actions", () => ({ captureEntry }));

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess }),
}));

import { CaptureDialog } from "./capture-dialog";

describe("CaptureDialog", () => {
  afterEach(() => vi.clearAllMocks());

  it("does not render when closed", () => {
    render(<CaptureDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("autofocuses the textarea when opened", () => {
    render(<CaptureDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText("What's on your mind?")).toHaveFocus();
  });

  it("submits, toasts, and closes on a successful capture", async () => {
    captureEntry.mockResolvedValue({ success: true });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<CaptureDialog open onOpenChange={onOpenChange} />);

    await user.type(screen.getByLabelText("What's on your mind?"), "a thought");
    await user.click(screen.getByRole("button", { name: "Capture" }));

    await waitFor(() => expect(captureEntry).toHaveBeenCalled());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Captured"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits on Ctrl+Enter without clicking the button", async () => {
    captureEntry.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<CaptureDialog open onOpenChange={vi.fn()} />);

    const textarea = screen.getByLabelText("What's on your mind?");
    await user.type(textarea, "quick one");
    await user.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => expect(captureEntry).toHaveBeenCalled());
  });

  it("surfaces a validation error without closing", async () => {
    captureEntry.mockResolvedValue({
      fieldError: "Write something to capture",
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<CaptureDialog open onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Capture" }));

    expect(
      await screen.findByText("Write something to capture")
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
