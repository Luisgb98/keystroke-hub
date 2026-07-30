import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import type { Idea } from "@/lib/db/schema";
import { IdeaCopyActions } from "./idea-copy-actions";

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    title: "Glitch tutorial",
    notes: "First paragraph.\n\nSecond paragraph.",
    format: "either",
    status: "idea",
    tags: ["speedrun", "glitch", "tutorial", "retro", "any%"],
    projectId: null,
    releaseEventId: null,
    releaseEventTrack: null,
    stageEnteredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("IdeaCopyActions", () => {
  const writeText = vi.fn();

  // `userEvent.setup()` installs its own clipboard stub, so the mock must be
  // (re-)defined *after* setup runs (see copy-summary-button.test.tsx).
  function mockClipboard() {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  }

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders a button for each of the four blocks", () => {
    render(<IdeaCopyActions idea={makeIdea()} />);
    expect(
      screen.getByRole("button", { name: "Copy Title" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy Title + tags" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy Description + tags" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy Tags" })
    ).toBeInTheDocument();
  });

  it("copies the title alone", async () => {
    writeText.mockResolvedValue(undefined);
    const user = userEvent.setup();
    mockClipboard();
    render(<IdeaCopyActions idea={makeIdea()} />);

    await user.click(screen.getByRole("button", { name: "Copy Title" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toBe("Glitch tutorial");
    expect(toastSuccess).toHaveBeenCalledWith("Copied title");
  });

  it("copies title, a blank line, then the tags", async () => {
    writeText.mockResolvedValue(undefined);
    const user = userEvent.setup();
    mockClipboard();
    render(<IdeaCopyActions idea={makeIdea()} />);

    await user.click(screen.getByRole("button", { name: "Copy Title + tags" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toBe(
      "Glitch tutorial\n\nspeedrun, glitch, tutorial, retro, any%"
    );
  });

  it("copies the description with its line breaks intact, then the tags", async () => {
    writeText.mockResolvedValue(undefined);
    const user = userEvent.setup();
    mockClipboard();
    render(<IdeaCopyActions idea={makeIdea()} />);

    await user.click(
      screen.getByRole("button", { name: "Copy Description + tags" })
    );

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toBe(
      "First paragraph.\n\nSecond paragraph.\n\nspeedrun, glitch, tutorial, retro, any%"
    );
  });

  it("copies the tags alone", async () => {
    writeText.mockResolvedValue(undefined);
    const user = userEvent.setup();
    mockClipboard();
    render(<IdeaCopyActions idea={makeIdea()} />);

    await user.click(screen.getByRole("button", { name: "Copy Tags" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toBe(
      "speedrun, glitch, tutorial, retro, any%"
    );
  });

  it("disables the tag-dependent blocks when the idea has no tags", () => {
    render(<IdeaCopyActions idea={makeIdea({ tags: [] })} />);

    expect(screen.getByRole("button", { name: "Copy Title" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Copy Title + tags" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy Tags" })).toBeDisabled();
    // Description + tags stays enabled — the description is still copyable.
    expect(
      screen.getByRole("button", { name: "Copy Description + tags" })
    ).toBeEnabled();
  });

  it("disables description + tags when the idea has no description", () => {
    render(<IdeaCopyActions idea={makeIdea({ notes: null })} />);
    expect(
      screen.getByRole("button", { name: "Copy Description + tags" })
    ).toBeDisabled();
  });

  it("toasts an error when the clipboard write is rejected", async () => {
    writeText.mockRejectedValue(new Error("blocked"));
    const user = userEvent.setup();
    mockClipboard();
    render(<IdeaCopyActions idea={makeIdea()} />);

    await user.click(screen.getByRole("button", { name: "Copy Title" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
