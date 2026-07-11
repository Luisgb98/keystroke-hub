import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import type { WeekSummary } from "@/lib/journal/week-summary";
import { CopySummaryButton } from "./copy-summary-button";

const SUMMARY: WeekSummary = {
  weekStart: "2026-07-06",
  doneByDay: [
    { date: "2026-07-06", done: [{ id: "i-1", title: "Shipped the thing" }] },
  ],
  retros: [],
  carriedOver: [],
  highlights: "Big week",
  isEmpty: false,
  rating: null,
  wentWell: "",
  drainedMe: "",
  changeNext: "",
  signals: {
    weekdaysLogged: 1,
    weekdayCount: 5,
    doneCount: 1,
    trackedCount: 1,
    carriedOverCount: 0,
  },
};

describe("CopySummaryButton", () => {
  const writeText = vi.fn();

  // `userEvent.setup()` installs its own clipboard stub, so the mock must be
  // (re-)defined *after* setup runs, not in a `beforeEach` — otherwise
  // user-event's stub clobbers it.
  function mockClipboard() {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  }

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("copies the formatted week summary to the clipboard and toasts a confirmation", async () => {
    writeText.mockResolvedValue(undefined);
    const user = userEvent.setup();
    mockClipboard();
    render(<CopySummaryButton summary={SUMMARY} />);

    await user.click(screen.getByRole("button", { name: "Copy as Markdown" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("Shipped the thing");
    expect(writeText.mock.calls[0][0]).toContain("Big week");
    expect(toastSuccess).toHaveBeenCalledWith("Copied the week's summary");
  });

  it("toasts an error when the clipboard write is rejected", async () => {
    writeText.mockRejectedValue(new Error("blocked"));
    const user = userEvent.setup();
    mockClipboard();
    render(<CopySummaryButton summary={SUMMARY} />);

    await user.click(screen.getByRole("button", { name: "Copy as Markdown" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
  });
});
