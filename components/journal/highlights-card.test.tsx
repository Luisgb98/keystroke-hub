import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const saveHighlights = vi.hoisted(() => vi.fn());
vi.mock("@/lib/journal/actions", () => ({ saveHighlights }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { HighlightsCard } from "./highlights-card";

describe("HighlightsCard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders the existing highlights text", () => {
    render(<HighlightsCard weekStart="2026-07-06" highlights="Shipped it" />);
    expect(screen.getByLabelText("Highlights")).toHaveValue("Shipped it");
  });

  it("autosaves after the debounce delay and shows Saved", async () => {
    saveHighlights.mockResolvedValue({});
    const user = userEvent.setup({ delay: null });
    render(<HighlightsCard weekStart="2026-07-06" highlights="" />);

    await user.type(screen.getByLabelText("Highlights"), "Great week");
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(saveHighlights).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(saveHighlights).toHaveBeenCalledWith("2026-07-06", "Great week");
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
  });

  it("debounces rapid keystrokes into a single save", async () => {
    saveHighlights.mockResolvedValue({});
    const user = userEvent.setup({ delay: null });
    render(<HighlightsCard weekStart="2026-07-06" highlights="" />);

    const field = screen.getByLabelText("Highlights");
    await user.type(field, "abc");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(saveHighlights).toHaveBeenCalledTimes(1);
    expect(saveHighlights).toHaveBeenCalledWith("2026-07-06", "abc");
  });

  it("toasts an error and drops the saved indicator when saving fails", async () => {
    saveHighlights.mockResolvedValue({
      error: "Keep it under 4000 characters",
    });
    const user = userEvent.setup({ delay: null });
    render(<HighlightsCard weekStart="2026-07-06" highlights="" />);

    await user.type(screen.getByLabelText("Highlights"), "x");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Keep it under 4000 characters")
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });
});
