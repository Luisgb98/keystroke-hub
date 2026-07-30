import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const saveScript = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/script-actions", () => ({ saveScript }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import type { Script } from "@/lib/db/schema";
import { IdeaScriptSection } from "./idea-script-section";

function makeScript(overrides: Partial<Script> = {}): Script {
  return {
    id: "script-1",
    ideaId: "idea-1",
    content: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const AUTOSAVE_DELAY_MS = 1800;

describe("IdeaScriptSection", () => {
  beforeEach(() => {
    saveScript.mockResolvedValue({
      updatedAt: new Date("2026-07-08T12:00:00Z"),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders the script read-only by default, with no editing chrome", () => {
    render(
      <IdeaScriptSection
        ideaId="idea-1"
        script={makeScript({ content: "# Cold open" })}
      />
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Cold open" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Script")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("shows an empty-state prompt when there is no script yet", () => {
    render(<IdeaScriptSection ideaId="idea-1" script={null} />);

    expect(screen.getByText(/No script yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("reveals the write surface only after clicking Edit", async () => {
    const user = userEvent.setup();
    render(
      <IdeaScriptSection
        ideaId="idea-1"
        script={makeScript({ content: "# Cold open" })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Script")).toHaveValue("# Cold open");
    expect(
      screen.queryByRole("heading", { level: 1, name: "Cold open" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("autosaves edits after the debounce window", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup();
    render(<IdeaScriptSection ideaId="idea-1" script={null} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Script"), {
      target: { value: "# Hook" },
    });
    expect(saveScript).not.toHaveBeenCalled();

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    await waitFor(() =>
      expect(saveScript).toHaveBeenCalledWith("idea-1", "# Hook")
    );
  });

  it("returns to the rendered view with the edited content when Done is clicked", async () => {
    const user = userEvent.setup();
    render(<IdeaScriptSection ideaId="idea-1" script={null} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Script"), {
      target: { value: "# Fresh take" },
    });
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByLabelText("Script")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Fresh take" })
    ).toBeInTheDocument();
    // Leaving edit mode flushes the still-pending debounced save.
    await waitFor(() =>
      expect(saveScript).toHaveBeenCalledWith("idea-1", "# Fresh take")
    );
  });
});
