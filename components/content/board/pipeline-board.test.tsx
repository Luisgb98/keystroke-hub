import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const updateIdeaStatus = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/actions", () => ({ updateIdeaStatus }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

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
    stageEnteredAt: new Date("2026-07-01T00:00:00Z"),
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

describe("PipelineBoard", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders one column per pipeline stage", () => {
    render(<PipelineBoard ideas={[]} />);
    expect(screen.getByText("Spark")).toBeInTheDocument();
    expect(screen.getByText("Outlined")).toBeInTheDocument();
    expect(screen.getByText("Scripted")).toBeInTheDocument();
    expect(screen.getByText("Recorded")).toBeInTheDocument();
    expect(screen.getByText("Edited")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Parked")).toBeInTheDocument();
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
          makeIdea({ id: "idea-2", title: "Parked idea", status: "parked" }),
        ]}
      />
    );
    expect(screen.getByText("Scripted idea")).toBeInTheDocument();
    expect(screen.getByText("Parked idea")).toBeInTheDocument();
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
});
