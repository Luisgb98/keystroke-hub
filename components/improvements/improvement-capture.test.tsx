import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const createImprovement = vi.hoisted(() => vi.fn());
vi.mock("@/lib/improvements/actions", () => ({ createImprovement }));

import { ImprovementCapture } from "./improvement-capture";

describe("ImprovementCapture", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders an inline capture card, rationale hidden until typing starts", () => {
    render(<ImprovementCapture projects={[]} />);
    expect(screen.getByLabelText("New improvement")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Rationale (optional)")
    ).not.toBeInTheDocument();
  });

  it("expands to show the rationale field once the user starts typing a title", async () => {
    const user = userEvent.setup();
    render(<ImprovementCapture projects={[]} />);

    await user.type(screen.getByLabelText("New improvement"), "A");

    expect(screen.getByLabelText("Rationale (optional)")).toBeInTheDocument();
  });

  it("does not show a project select when there are no linkable projects", async () => {
    const user = userEvent.setup();
    render(<ImprovementCapture projects={[]} />);
    await user.type(screen.getByLabelText("New improvement"), "A");
    expect(
      screen.queryByText("Related project (optional)")
    ).not.toBeInTheDocument();
  });

  it("shows a project select when linkable projects exist", async () => {
    const user = userEvent.setup();
    render(
      <ImprovementCapture projects={[{ id: "p-1", name: "Keystroke Hub" }]} />
    );
    await user.type(screen.getByLabelText("New improvement"), "A");
    expect(screen.getByText("Related project (optional)")).toBeInTheDocument();
  });

  it("submits a title-only capture with an empty project id", async () => {
    createImprovement.mockResolvedValue({
      success: true,
      improvementId: "i-1",
    });
    const user = userEvent.setup();
    render(<ImprovementCapture projects={[]} />);

    await user.type(
      screen.getByLabelText("New improvement"),
      "Automate the changelog"
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(createImprovement).toHaveBeenCalledTimes(1));
    const [, formData] = createImprovement.mock.calls[0] as [unknown, FormData];
    expect(formData.get("title")).toBe("Automate the changelog");
    expect(formData.get("projectId")).toBe("");
  });

  it("resets and collapses after a successful capture", async () => {
    createImprovement.mockResolvedValue({
      success: true,
      improvementId: "i-1",
    });
    const user = userEvent.setup();
    render(<ImprovementCapture projects={[]} />);

    await user.type(screen.getByLabelText("New improvement"), "Automate it");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(screen.getByLabelText("New improvement")).toHaveValue("")
    );
    expect(
      screen.queryByLabelText("Rationale (optional)")
    ).not.toBeInTheDocument();
  });

  it("shows a field error on invalid input", async () => {
    createImprovement.mockResolvedValue({
      error: "Check the highlighted fields.",
      fieldErrors: { title: ["Title is required"] },
    });
    const user = userEvent.setup();
    render(<ImprovementCapture projects={[]} />);

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
  });
});
