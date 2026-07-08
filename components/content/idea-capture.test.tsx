import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const createIdea = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/actions", () => ({ createIdea }));

import { IdeaCapture } from "./idea-capture";

describe("IdeaCapture", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders a floating 'New idea' button, closed by default", () => {
    render(<IdeaCapture />);
    expect(
      screen.getByRole("button", { name: "New idea" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the capture dialog with title auto-focused", async () => {
    const user = userEvent.setup();
    render(<IdeaCapture />);

    await user.click(screen.getByRole("button", { name: "New idea" }));

    const dialog = screen.getByRole("dialog", { name: "New idea" });
    expect(dialog).toBeVisible();
    expect(screen.getByLabelText("Title")).toHaveFocus();
  });

  it("defaults format to Either and lets the user pick a different one", async () => {
    const user = userEvent.setup();
    render(<IdeaCapture />);
    await user.click(screen.getByRole("button", { name: "New idea" }));

    expect(screen.getByRole("radio", { name: "Either" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    await user.click(screen.getByRole("radio", { name: "Video" }));
    expect(screen.getByRole("radio", { name: "Video" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: "Either" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("submits a title-only capture", async () => {
    createIdea.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<IdeaCapture />);
    await user.click(screen.getByRole("button", { name: "New idea" }));

    await user.type(screen.getByLabelText("Title"), "Speedrun commentary");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createIdea).toHaveBeenCalledTimes(1));
    const [, formData] = createIdea.mock.calls[0] as [unknown, FormData];
    expect(formData.get("title")).toBe("Speedrun commentary");
  });

  it("closes and resets after a successful capture", async () => {
    createIdea.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<IdeaCapture />);
    await user.click(screen.getByRole("button", { name: "New idea" }));
    await user.type(screen.getByLabelText("Title"), "Speedrun commentary");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("shows a field error on invalid input without closing", async () => {
    createIdea.mockResolvedValue({
      error: "Check the highlighted fields.",
      fieldErrors: { title: ["Title is required"] },
    });
    const user = userEvent.setup();
    render(<IdeaCapture />);
    await user.click(screen.getByRole("button", { name: "New idea" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeVisible();
  });
});
