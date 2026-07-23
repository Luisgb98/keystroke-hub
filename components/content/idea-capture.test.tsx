import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DockActionProvider,
  useDockAction,
} from "@/components/shell/dock-action-provider";

const createIdea = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/actions", () => ({ createIdea }));

import { IdeaCapture } from "./idea-capture";

/** Surfaces the dock action IdeaCapture registers so tests can trigger it. */
function DockActionSurface() {
  const action = useDockAction();
  if (!action) return null;
  const Icon = action.icon;
  return (
    <button type="button" onClick={action.onSelect}>
      <Icon aria-hidden />
      {action.label}
    </button>
  );
}

/** IdeaCapture has no button of its own — it registers with the shared dock. */
function renderWithDock(ui: ReactNode) {
  return render(
    <DockActionProvider>
      {ui}
      <DockActionSurface />
    </DockActionProvider>
  );
}

describe("IdeaCapture", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("registers a 'New idea' dock action, dialog closed by default", () => {
    renderWithDock(<IdeaCapture />);
    expect(
      screen.getByRole("button", { name: "New idea" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the capture dialog with title auto-focused", async () => {
    const user = userEvent.setup();
    renderWithDock(<IdeaCapture />);

    await user.click(screen.getByRole("button", { name: "New idea" }));

    const dialog = screen.getByRole("dialog", { name: "New idea" });
    expect(dialog).toBeVisible();
    expect(screen.getByLabelText("Title")).toHaveFocus();
  });

  it("defaults format to Either and lets the user pick a different one", async () => {
    const user = userEvent.setup();
    renderWithDock(<IdeaCapture />);
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
    renderWithDock(<IdeaCapture />);
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
    renderWithDock(<IdeaCapture />);
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
    renderWithDock(<IdeaCapture />);
    await user.click(screen.getByRole("button", { name: "New idea" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeVisible();
  });
});
