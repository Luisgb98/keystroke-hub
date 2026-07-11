import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const saveRetro = vi.hoisted(() => vi.fn());
vi.mock("@/lib/journal/actions", () => ({ saveRetro }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { RetroCard } from "./retro-card";

describe("RetroCard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders the existing retro text", () => {
    render(<RetroCard logDate="2026-07-08" retro="Great day" />);
    expect(screen.getByLabelText("How did today go?")).toHaveValue("Great day");
  });

  it("autosaves after the debounce delay and shows Saved", async () => {
    saveRetro.mockResolvedValue({});
    const user = userEvent.setup({ delay: null });
    render(<RetroCard logDate="2026-07-08" retro={null} />);

    await user.type(screen.getByLabelText("How did today go?"), "It went well");
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(saveRetro).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(saveRetro).toHaveBeenCalledWith("2026-07-08", "It went well");
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
  });

  it("debounces rapid keystrokes into a single save", async () => {
    saveRetro.mockResolvedValue({});
    const user = userEvent.setup({ delay: null });
    render(<RetroCard logDate="2026-07-08" retro={null} />);

    const field = screen.getByLabelText("How did today go?");
    await user.type(field, "abc");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(saveRetro).toHaveBeenCalledTimes(1);
    expect(saveRetro).toHaveBeenCalledWith("2026-07-08", "abc");
  });

  it("toasts an error and drops the saved indicator when saving fails", async () => {
    saveRetro.mockResolvedValue({ error: "Keep it under 4000 characters" });
    const user = userEvent.setup({ delay: null });
    render(<RetroCard logDate="2026-07-08" retro={null} />);

    await user.type(screen.getByLabelText("How did today go?"), "x");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Keep it under 4000 characters")
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });
});
