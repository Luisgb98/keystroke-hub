import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Idea } from "@/lib/db/schema";

import { StageColumn } from "./stage-column";

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    title: "Speedrun any% commentary",
    description: null,
    format: "either",
    status: "scripted",
    tags: [],
    projectId: null,
    gameId: null,
    releaseEventId: null,
    releaseEventTrack: null,
    stageEnteredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("StageColumn", () => {
  it("renders the stage label and card count", () => {
    render(
      <StageColumn
        status="scripted"
        ideas={[makeIdea(), makeIdea({ id: "idea-2" })]}
        onMove={vi.fn()}
      />
    );
    expect(screen.getByText("Scripted")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows the per-stage empty-state copy when there are no ideas", () => {
    render(<StageColumn status="edited" ideas={[]} onMove={vi.fn()} />);
    expect(
      screen.getByText("Nothing in the edit bay — cut a recording next.")
    ).toBeInTheDocument();
  });

  it("renders a card per idea", () => {
    render(
      <StageColumn
        status="scripted"
        ideas={[
          makeIdea({ id: "idea-1", title: "First idea" }),
          makeIdea({ id: "idea-2", title: "Second idea" }),
        ]}
        onMove={vi.fn()}
      />
    );
    expect(screen.getByText("First idea")).toBeInTheDocument();
    expect(screen.getByText("Second idea")).toBeInTheDocument();
  });

  it("tags itself with its stage, which is what a drop is hit-tested against", () => {
    const { container } = render(
      <StageColumn status="recorded" ideas={[]} onMove={vi.fn()} />
    );
    expect(
      container.querySelector('[data-slot="stage-column"]')
    ).toHaveAttribute("data-status", "recorded");
  });

  it("is not a drop target by default", () => {
    const { container } = render(
      <StageColumn status="recorded" ideas={[makeIdea()]} onMove={vi.fn()} />
    );
    expect(
      container.querySelector('[data-slot="stage-column"]')
    ).toHaveAttribute("data-drop-target", "false");
  });

  it("flags itself as the drop target while a card hovers it", () => {
    const { container } = render(
      <StageColumn
        status="recorded"
        ideas={[makeIdea()]}
        onMove={vi.fn()}
        isDropTarget
      />
    );
    expect(
      container.querySelector('[data-slot="stage-column"]')
    ).toHaveAttribute("data-drop-target", "true");
  });

  it("is a valid drop target while empty, with the empty-state copy still showing", () => {
    const { container } = render(
      <StageColumn status="edited" ideas={[]} onMove={vi.fn()} isDropTarget />
    );
    expect(
      container.querySelector('[data-slot="stage-column"]')
    ).toHaveAttribute("data-drop-target", "true");
    expect(
      screen.getByText("Nothing in the edit bay — cut a recording next.")
    ).toBeInTheDocument();
  });

  it("starts a drag for the pressed card, and only that card", () => {
    const onCardDragStart = vi.fn();
    const first = makeIdea({ id: "idea-1", title: "First idea" });
    const second = makeIdea({ id: "idea-2", title: "Second idea" });
    const { container } = render(
      <StageColumn
        status="scripted"
        ideas={[first, second]}
        onMove={vi.fn()}
        onCardDragStart={onCardDragStart}
      />
    );

    const cards = container.querySelectorAll('[data-slot="board-card"]');
    fireEvent.pointerDown(cards[1], { clientX: 5, clientY: 5 });

    expect(onCardDragStart).toHaveBeenCalledTimes(1);
    expect(onCardDragStart.mock.calls[0][0]).toEqual(second);
  });

  it("renders the airborne card as a placeholder in the column it left", () => {
    const idea = makeIdea({ id: "idea-1", title: "First idea" });
    const { container } = render(
      <StageColumn
        status="scripted"
        ideas={[idea]}
        onMove={vi.fn()}
        onCardDragStart={vi.fn()}
        draggingIdeaId="idea-1"
      />
    );
    expect(container.querySelector('[data-slot="board-card"]')).toHaveAttribute(
      "data-dragging",
      "true"
    );
  });

  it("leaves cards tap-only when no drag handler is wired", () => {
    const { container } = render(
      <StageColumn status="scripted" ideas={[makeIdea()]} onMove={vi.fn()} />
    );
    expect(
      container.querySelector('[data-slot="board-card-grip"]')
    ).not.toBeInTheDocument();
  });
});
