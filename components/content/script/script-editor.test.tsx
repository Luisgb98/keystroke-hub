import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { format } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/content/ideas/idea-1/script",
}));

const saveScript = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/script-actions", () => ({ saveScript }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import type { Idea, Script } from "@/lib/db/schema";
import { ScriptEditor } from "./script-editor";

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    title: "Speedrun any% commentary",
    notes: null,
    format: "video",
    status: "scripted",
    tags: [],
    projectId: null,
    stageEnteredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

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

describe("ScriptEditor", () => {
  beforeEach(() => {
    saveScript.mockResolvedValue({
      updatedAt: new Date("2026-07-08T12:00:00Z"),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders the idea title and the script's saved content", () => {
    render(
      <ScriptEditor
        idea={makeIdea()}
        script={makeScript({ content: "# Cold open" })}
        initialView="write"
      />
    );

    expect(screen.getByText("Speedrun any% commentary")).toBeInTheDocument();
    expect(screen.getByLabelText("Script")).toHaveValue("# Cold open");
  });

  it("autosaves after the debounce window and shows the saved indicator", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <ScriptEditor idea={makeIdea()} script={null} initialView="write" />
    );

    fireEvent.change(screen.getByLabelText("Script"), {
      target: { value: "# Hook" },
    });
    expect(saveScript).not.toHaveBeenCalled();

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    await waitFor(() =>
      expect(saveScript).toHaveBeenCalledWith("idea-1", "# Hook")
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          `Saved ${format(new Date("2026-07-08T12:00:00Z"), "HH:mm")}`
        )
      ).toBeInTheDocument()
    );
  });

  it("coalesces rapid typing into a single save", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <ScriptEditor idea={makeIdea()} script={null} initialView="write" />
    );
    const textarea = screen.getByLabelText("Script");

    fireEvent.change(textarea, { target: { value: "a" } });
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 200);
    fireEvent.change(textarea, { target: { value: "ab" } });
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 200);
    fireEvent.change(textarea, { target: { value: "abc" } });
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    await waitFor(() => expect(saveScript).toHaveBeenCalledTimes(1));
    expect(saveScript).toHaveBeenCalledWith("idea-1", "abc");
  });

  it("Cmd/Ctrl+S saves immediately, bypassing the debounce", async () => {
    render(
      <ScriptEditor idea={makeIdea()} script={null} initialView="write" />
    );

    fireEvent.change(screen.getByLabelText("Script"), {
      target: { value: "# Hook" },
    });
    fireEvent.keyDown(window, { key: "s", metaKey: true });

    await waitFor(() =>
      expect(saveScript).toHaveBeenCalledWith("idea-1", "# Hook")
    );
  });

  it("the Save button saves immediately", async () => {
    render(
      <ScriptEditor idea={makeIdea()} script={null} initialView="write" />
    );

    fireEvent.change(screen.getByLabelText("Script"), {
      target: { value: "# Hook" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(saveScript).toHaveBeenCalledWith("idea-1", "# Hook")
    );
  });

  it("shows a retry affordance and toasts on save failure", async () => {
    saveScript.mockResolvedValueOnce({ error: "Something went wrong." });
    render(
      <ScriptEditor idea={makeIdea()} script={null} initialView="write" />
    );

    fireEvent.change(screen.getByLabelText("Script"), {
      target: { value: "# Hook" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save failed — retry" })
      ).toBeInTheDocument()
    );
    expect(toastError).toHaveBeenCalledWith("Something went wrong.");

    saveScript.mockResolvedValueOnce({
      updatedAt: new Date("2026-07-08T12:00:00Z"),
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save failed — retry" })
    );

    await waitFor(() => expect(saveScript).toHaveBeenCalledTimes(2));
  });

  it("switching to Read renders the rendered Markdown, distinct from Write", () => {
    render(
      <ScriptEditor
        idea={makeIdea()}
        script={makeScript({ content: "# Cold open" })}
        initialView="write"
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Read" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Cold open" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Script")).not.toBeInTheDocument();
  });

  it("reflects the active view in the URL without a full navigation", () => {
    render(
      <ScriptEditor idea={makeIdea()} script={null} initialView="write" />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Read" }));
    expect(replace).toHaveBeenCalledWith(
      "/content/ideas/idea-1/script?view=read",
      { scroll: false }
    );

    fireEvent.click(screen.getByRole("tab", { name: "Write" }));
    expect(replace).toHaveBeenCalledWith("/content/ideas/idea-1/script", {
      scroll: false,
    });
  });

  it("blocks an unload while a save is pending or in flight", () => {
    render(
      <ScriptEditor idea={makeIdea()} script={null} initialView="write" />
    );

    fireEvent.change(screen.getByLabelText("Script"), {
      target: { value: "# Hook" },
    });

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
