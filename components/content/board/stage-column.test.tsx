import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Idea } from "@/lib/db/schema";

import { StageColumn } from "./stage-column";

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    title: "Speedrun any% commentary",
    notes: null,
    format: "either",
    status: "scripted",
    tags: [],
    projectId: null,
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
});
