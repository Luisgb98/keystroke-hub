import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const saveMood = vi.hoisted(() => vi.fn());
vi.mock("@/lib/journal/actions", () => ({ saveMood }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { MoodPicker } from "./mood-picker";

describe("MoodPicker", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders all five steps with icon + label", () => {
    render(<MoodPicker logDate="2026-07-08" mood={null} />);
    for (const label of ["Drained", "Low", "Okay", "Good", "Energized"]) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the current mood as checked", () => {
    render(<MoodPicker logDate="2026-07-08" mood={4} />);
    expect(screen.getByRole("radio", { name: "Good" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: "Okay" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("selecting a step saves it", async () => {
    saveMood.mockResolvedValue({});
    const user = userEvent.setup();
    render(<MoodPicker logDate="2026-07-08" mood={null} />);

    await user.click(screen.getByRole("radio", { name: "Energized" }));

    await waitFor(() => expect(saveMood).toHaveBeenCalledWith("2026-07-08", 5));
  });

  it("tapping the selected step again clears it", async () => {
    saveMood.mockResolvedValue({});
    const user = userEvent.setup();
    render(<MoodPicker logDate="2026-07-08" mood={3} />);

    await user.click(screen.getByRole("radio", { name: "Okay" }));

    await waitFor(() =>
      expect(saveMood).toHaveBeenCalledWith("2026-07-08", null)
    );
  });

  it("reverts the selection and toasts on error", async () => {
    saveMood.mockResolvedValue({ error: "That mood isn't valid." });
    const user = userEvent.setup();
    render(<MoodPicker logDate="2026-07-08" mood={null} />);

    await user.click(screen.getByRole("radio", { name: "Good" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That mood isn't valid.")
    );
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Good" })).toHaveAttribute(
        "aria-checked",
        "false"
      )
    );
  });
});
