import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const updateImprovementStatus = vi.hoisted(() => vi.fn());
vi.mock("@/lib/improvements/actions", () => ({ updateImprovementStatus }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: toastError }),
}));

import { ImprovementStatusSelect } from "./improvement-status-select";

describe("ImprovementStatusSelect", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("submits the new status on change", async () => {
    updateImprovementStatus.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ImprovementStatusSelect improvementId="i-1" status="proposed" />);

    await user.selectOptions(screen.getByLabelText("Status"), "discussed");

    await waitFor(() =>
      expect(updateImprovementStatus).toHaveBeenCalledWith("i-1", "discussed")
    );
  });

  it("only offers the plain-select statuses", () => {
    render(<ImprovementStatusSelect improvementId="i-1" status="proposed" />);
    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual(["Proposed", "Discussed", "Done"]);
  });

  it("includes the current status as a disabled-select fallback when it's accepted/rejected", () => {
    render(<ImprovementStatusSelect improvementId="i-1" status="accepted" />);
    expect(screen.getByLabelText("Status")).toHaveValue("accepted");
  });

  it("toasts an error when the update fails", async () => {
    updateImprovementStatus.mockResolvedValue({ error: "Nope." });
    const user = userEvent.setup();
    render(<ImprovementStatusSelect improvementId="i-1" status="proposed" />);

    await user.selectOptions(screen.getByLabelText("Status"), "done");

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Nope."));
  });

  it("is disabled when the disabled prop is set", () => {
    render(
      <ImprovementStatusSelect improvementId="i-1" status="proposed" disabled />
    );
    expect(screen.getByLabelText("Status")).toBeDisabled();
  });
});
