import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const createProject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/projects/actions", () => ({ createProject }));

import { ProjectCapture } from "./project-capture";

describe("ProjectCapture", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders an inline capture card, description hidden until typing starts", () => {
    render(<ProjectCapture />);
    expect(screen.getByLabelText("New project")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Description (optional)")
    ).not.toBeInTheDocument();
  });

  it("expands to show the description field once the user starts typing a name", async () => {
    const user = userEvent.setup();
    render(<ProjectCapture />);

    await user.type(screen.getByLabelText("New project"), "K");

    expect(screen.getByLabelText("Description (optional)")).toBeInTheDocument();
  });

  it("submits a name-only capture", async () => {
    createProject.mockResolvedValue({ success: true, projectId: "p-1" });
    const user = userEvent.setup();
    render(<ProjectCapture />);

    await user.type(screen.getByLabelText("New project"), "Keystroke Hub");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(createProject).toHaveBeenCalledTimes(1));
    const [, formData] = createProject.mock.calls[0] as [unknown, FormData];
    expect(formData.get("name")).toBe("Keystroke Hub");
  });

  it("resets and collapses after a successful capture", async () => {
    createProject.mockResolvedValue({ success: true, projectId: "p-1" });
    const user = userEvent.setup();
    render(<ProjectCapture />);

    await user.type(screen.getByLabelText("New project"), "Keystroke Hub");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(screen.getByLabelText("New project")).toHaveValue("")
    );
    expect(
      screen.queryByLabelText("Description (optional)")
    ).not.toBeInTheDocument();
  });

  it("shows a field error on invalid input", async () => {
    createProject.mockResolvedValue({
      error: "Check the highlighted fields.",
      fieldErrors: { name: ["Name is required"] },
    });
    const user = userEvent.setup();
    render(<ProjectCapture />);

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
  });
});
