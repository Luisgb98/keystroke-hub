import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const saveWeeklyRating = vi.hoisted(() => vi.fn());
vi.mock("@/lib/journal/actions", () => ({ saveWeeklyRating }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { WeekRatingPicker } from "./week-rating-picker";

describe("WeekRatingPicker", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders all five steps with their word anchors", () => {
    render(<WeekRatingPicker weekStart="2026-07-06" rating={null} />);
    for (const label of ["Rough", "Bumpy", "Steady", "Strong", "Great"]) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the current rating as checked", () => {
    render(<WeekRatingPicker weekStart="2026-07-06" rating={4} />);
    expect(screen.getByRole("radio", { name: "Strong" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: "Steady" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("selecting a step saves it", async () => {
    saveWeeklyRating.mockResolvedValue({});
    const user = userEvent.setup();
    render(<WeekRatingPicker weekStart="2026-07-06" rating={null} />);

    await user.click(screen.getByRole("radio", { name: "Great" }));

    await waitFor(() =>
      expect(saveWeeklyRating).toHaveBeenCalledWith("2026-07-06", 5)
    );
  });

  it("tapping the selected step again clears it", async () => {
    saveWeeklyRating.mockResolvedValue({});
    const user = userEvent.setup();
    render(<WeekRatingPicker weekStart="2026-07-06" rating={3} />);

    await user.click(screen.getByRole("radio", { name: "Steady" }));

    await waitFor(() =>
      expect(saveWeeklyRating).toHaveBeenCalledWith("2026-07-06", null)
    );
  });

  it("reverts the selection and toasts on error", async () => {
    saveWeeklyRating.mockResolvedValue({ error: "That rating isn't valid." });
    const user = userEvent.setup();
    render(<WeekRatingPicker weekStart="2026-07-06" rating={null} />);

    await user.click(screen.getByRole("radio", { name: "Rough" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That rating isn't valid.")
    );
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Rough" })).toHaveAttribute(
        "aria-checked",
        "false"
      )
    );
  });

  it("marks the selected step with a solid accent fill, not a primary tint", () => {
    // Same rule as MoodPicker — a primary tint now reads as destructive
    // (see docs/design-system.md, #84).
    render(<WeekRatingPicker weekStart="2026-07-06" rating={3} />);
    const selected = screen.getByRole("radio", { name: "Steady" });

    expect(selected).toHaveClass("bg-primary", "text-primary-foreground");
    expect(selected.className).not.toContain("bg-primary/10");
    expect(selected.className).not.toMatch(/(^|\s)text-primary(\s|$)/);
  });
});
