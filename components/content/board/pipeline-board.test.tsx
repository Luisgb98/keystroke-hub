import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateIdeaStatus = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/actions", () => ({ updateIdeaStatus }));

const getIdeaChecklistItems = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/checklist-actions", () => ({
  getIdeaChecklistItems,
  toggleIdeaChecklistItem: vi.fn(),
  addIdeaChecklistItem: vi.fn(),
  removeIdeaChecklistItem: vi.fn(),
}));

// sonner's `toast` is callable *and* carries `.error`/`.success` methods —
// mirror that shape so both call styles pipeline-board uses are covered.
const toastFn = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(toastFn, { error: toastError }),
}));

import type { Idea } from "@/lib/db/schema";
import { PipelineBoard } from "./pipeline-board";

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    title: "Speedrun any% commentary",
    notes: null,
    format: "either",
    status: "scripted",
    tags: [],
    projectId: null,
    releaseEventId: null,
    releaseEventTrack: null,
    stageEnteredAt: new Date("2026-07-01T00:00:00Z"),
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

describe("PipelineBoard", () => {
  beforeEach(() => {
    getIdeaChecklistItems.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders exactly one column per pipeline stage", () => {
    const { container } = render(<PipelineBoard ideas={[]} />);
    expect(screen.getByText("Idea")).toBeInTheDocument();
    expect(screen.getByText("Scripted")).toBeInTheDocument();
    expect(screen.getByText("Recorded")).toBeInTheDocument();
    expect(screen.getByText("Edited")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-slot="stage-column"]')
    ).toHaveLength(5);
  });

  it("groups ideas into their matching stage columns", () => {
    render(
      <PipelineBoard
        ideas={[
          makeIdea({
            id: "idea-1",
            title: "Scripted idea",
            status: "scripted",
          }),
          makeIdea({ id: "idea-2", title: "Fresh idea", status: "idea" }),
        ]}
      />
    );
    expect(screen.getByText("Scripted idea")).toBeInTheDocument();
    expect(screen.getByText("Fresh idea")).toBeInTheDocument();
  });

  it("optimistically moves a card to the target column while the request is pending", async () => {
    // A controllable, never-auto-resolving promise: `useOptimistic` only
    // shows the optimistic value *during* the pending transition — once
    // `updateIdeaStatus` settles without the `ideas` prop itself changing
    // (as happens here, since this is a static unit-test prop rather than a
    // server revalidation), React reverts to the base value. So this test
    // asserts the jump mid-flight, not after settling.
    let resolveUpdate: (result: { error?: string }) => void = () => {};
    updateIdeaStatus.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
    );
    const user = userEvent.setup();
    const idea = makeIdea({ title: "Speedrun commentary", status: "scripted" });
    render(<PipelineBoard ideas={[idea]} />);

    await user.click(
      screen.getByRole("button", { name: 'Move "Speedrun commentary"' })
    );
    await user.click(await screen.findByRole("menuitem", { name: "Recorded" }));

    const recordedColumn = screen
      .getByRole("heading", { name: "Recorded" })
      .closest('[data-slot="stage-column"]') as HTMLElement;
    await waitFor(() =>
      expect(
        within(recordedColumn).getByText("Speedrun commentary")
      ).toBeInTheDocument()
    );

    resolveUpdate({});
    await waitFor(() =>
      expect(updateIdeaStatus).toHaveBeenCalledWith(idea.id, "recorded")
    );
  });

  it("toasts an error when the move fails", async () => {
    updateIdeaStatus.mockResolvedValue({
      error: "That idea no longer exists.",
    });
    const user = userEvent.setup();
    const idea = makeIdea({ title: "Speedrun commentary", status: "scripted" });
    render(<PipelineBoard ideas={[idea]} />);

    await user.click(
      screen.getByRole("button", { name: 'Move "Speedrun commentary"' })
    );
    await user.click(await screen.findByRole("menuitem", { name: "Recorded" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That idea no longer exists.")
    );
  });

  it("renders a checklist chip when progress is provided", () => {
    const idea = makeIdea({ title: "Boss rush", status: "recorded" });
    render(
      <PipelineBoard
        ideas={[idea]}
        checklistProgress={new Map([[idea.id, { done: 2, total: 4 }]])}
      />
    );
    expect(screen.getByText("2/4")).toBeInTheDocument();
  });

  it("shows a nudge toast (with an open-checklist action) when publishing with unchecked items", async () => {
    updateIdeaStatus.mockResolvedValue({ uncheckedCount: 2 });
    const user = userEvent.setup();
    const idea = makeIdea({ title: "Speedrun commentary", status: "edited" });
    render(<PipelineBoard ideas={[idea]} />);

    await user.click(
      screen.getByRole("button", { name: 'Move "Speedrun commentary"' })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Published" })
    );

    await waitFor(() =>
      expect(toastFn).toHaveBeenCalledWith(
        "Published with 2 unchecked checklist items",
        expect.objectContaining({
          action: expect.objectContaining({ label: "Open checklist" }),
        })
      )
    );
  });

  it("opens the checklist dialog when the nudge toast's action runs", async () => {
    updateIdeaStatus.mockResolvedValue({ uncheckedCount: 1 });
    const user = userEvent.setup();
    const idea = makeIdea({ title: "Speedrun commentary", status: "edited" });
    render(<PipelineBoard ideas={[idea]} />);

    await user.click(
      screen.getByRole("button", { name: 'Move "Speedrun commentary"' })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Published" })
    );
    await waitFor(() => expect(toastFn).toHaveBeenCalled());

    const [, options] = toastFn.mock.calls[0];
    options.action.onClick();

    expect(
      await screen.findByRole("dialog", { name: "Publish checklist" })
    ).toBeInTheDocument();
  });

  it("does not toast when publishing with everything checked", async () => {
    updateIdeaStatus.mockResolvedValue({ uncheckedCount: 0 });
    const user = userEvent.setup();
    const idea = makeIdea({ title: "Speedrun commentary", status: "edited" });
    render(<PipelineBoard ideas={[idea]} />);

    await user.click(
      screen.getByRole("button", { name: 'Move "Speedrun commentary"' })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Published" })
    );

    await waitFor(() =>
      expect(updateIdeaStatus).toHaveBeenCalledWith(idea.id, "published")
    );
    expect(toastFn).not.toHaveBeenCalled();
  });
});
