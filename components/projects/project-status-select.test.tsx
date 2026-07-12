import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const updateProjectStatus = vi.hoisted(() => vi.fn());
vi.mock("@/lib/projects/actions", () => ({ updateProjectStatus }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: toastError }),
}));

import { ProjectStatusSelect } from "./project-status-select";

describe("ProjectStatusSelect", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("submits the new status on change", async () => {
    updateProjectStatus.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ProjectStatusSelect projectId="p-1" status="active" />);

    await user.selectOptions(screen.getByLabelText("Status"), "paused");

    await waitFor(() =>
      expect(updateProjectStatus).toHaveBeenCalledWith("p-1", "paused")
    );
  });

  it("toasts an error when the update fails", async () => {
    updateProjectStatus.mockResolvedValue({ error: "Nope." });
    const user = userEvent.setup();
    render(<ProjectStatusSelect projectId="p-1" status="active" />);

    await user.selectOptions(screen.getByLabelText("Status"), "done");

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Nope."));
  });

  it("is disabled when the disabled prop is set", () => {
    render(<ProjectStatusSelect projectId="p-1" status="active" disabled />);
    expect(screen.getByLabelText("Status")).toBeDisabled();
  });
});
