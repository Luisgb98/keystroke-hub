import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const saveAssessmentNote = vi.hoisted(() => vi.fn());
const saveWeeklyRating = vi.hoisted(() => vi.fn());
vi.mock("@/lib/journal/actions", () => ({
  saveAssessmentNote,
  saveWeeklyRating,
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { WeeklyAssessmentCard } from "./weekly-assessment-card";

describe("WeeklyAssessmentCard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders the rating picker and the existing prompt values", () => {
    render(
      <WeeklyAssessmentCard
        weekStart="2026-07-06"
        rating={4}
        wentWell="Shipped the release"
        drainedMe="Too many meetings"
        changeNext="Fewer meetings"
      />
    );

    expect(
      screen.getByRole("radiogroup", { name: "Week rating" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("What went well?")).toHaveValue(
      "Shipped the release"
    );
    expect(screen.getByLabelText("What drained you?")).toHaveValue(
      "Too many meetings"
    );
    expect(screen.getByLabelText("One thing to change next week")).toHaveValue(
      "Fewer meetings"
    );
  });

  it("autosaves the went-well prompt after the debounce delay and shows Saved", async () => {
    saveAssessmentNote.mockResolvedValue({});
    const user = userEvent.setup({ delay: null });
    render(
      <WeeklyAssessmentCard
        weekStart="2026-07-06"
        rating={null}
        wentWell=""
        drainedMe=""
        changeNext=""
      />
    );

    await user.type(screen.getByLabelText("What went well?"), "Good demo");
    expect(saveAssessmentNote).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(saveAssessmentNote).toHaveBeenCalledWith(
      "2026-07-06",
      "wentWell",
      "Good demo"
    );
  });

  it("autosaves each prompt independently under its own field", async () => {
    saveAssessmentNote.mockResolvedValue({});
    const user = userEvent.setup({ delay: null });
    render(
      <WeeklyAssessmentCard
        weekStart="2026-07-06"
        rating={null}
        wentWell=""
        drainedMe=""
        changeNext=""
      />
    );

    await user.type(screen.getByLabelText("What drained you?"), "Meetings");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(saveAssessmentNote).toHaveBeenCalledWith(
      "2026-07-06",
      "drainedMe",
      "Meetings"
    );
    expect(saveAssessmentNote).toHaveBeenCalledTimes(1);
  });

  it("toasts an error and drops the saved indicator when a prompt save fails", async () => {
    saveAssessmentNote.mockResolvedValue({
      error: "Keep it under 2000 characters",
    });
    const user = userEvent.setup({ delay: null });
    render(
      <WeeklyAssessmentCard
        weekStart="2026-07-06"
        rating={null}
        wentWell=""
        drainedMe=""
        changeNext=""
      />
    );

    await user.type(screen.getByLabelText("What went well?"), "x");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Keep it under 2000 characters")
    );
  });
});
