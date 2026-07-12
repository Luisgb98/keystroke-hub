import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const recordImprovementOutcome = vi.hoisted(() => vi.fn());
vi.mock("@/lib/improvements/actions", () => ({ recordImprovementOutcome }));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: toastError }),
}));

import { RecordOutcomeDialog } from "./record-outcome-dialog";

describe("RecordOutcomeDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when closed", () => {
    render(
      <RecordOutcomeDialog
        improvementId="i-1"
        improvementTitle="Automate the changelog"
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables save until a decision is picked", () => {
    render(
      <RecordOutcomeDialog
        improvementId="i-1"
        improvementTitle="Automate the changelog"
        open
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Save outcome" })).toBeDisabled();
  });

  it("records accepted with outcome text and closes", async () => {
    recordImprovementOutcome.mockResolvedValue({});
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <RecordOutcomeDialog
        improvementId="i-1"
        improvementTitle="Automate the changelog"
        open
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole("radio", { name: "Accepted" }));
    await user.type(
      screen.getByLabelText("Outcome (optional)"),
      "Ship in the next sprint"
    );
    await user.click(screen.getByRole("button", { name: "Save outcome" }));

    await waitFor(() =>
      expect(recordImprovementOutcome).toHaveBeenCalledWith(
        "i-1",
        "accepted",
        "Ship in the next sprint"
      )
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toastSuccess).toHaveBeenCalledWith(
      '"Automate the changelog" marked accepted'
    );
  });

  it("toasts an error when the write fails", async () => {
    recordImprovementOutcome.mockResolvedValue({
      error: "That improvement no longer exists.",
    });
    const user = userEvent.setup();
    render(
      <RecordOutcomeDialog
        improvementId="i-1"
        improvementTitle="Automate the changelog"
        open
        onOpenChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("radio", { name: "Rejected" }));
    await user.click(screen.getByRole("button", { name: "Save outcome" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "That improvement no longer exists."
      )
    );
  });
});
