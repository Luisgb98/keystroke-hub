import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PipelineSnapshot } from "@/lib/data/dashboard";

import { PipelineView } from "./pipeline-card";

function snapshot(overrides: Partial<PipelineSnapshot> = {}): PipelineSnapshot {
  const stages = overrides.stages ?? [
    { status: "idea" as const, count: 4 },
    { status: "scripted" as const, count: 2 },
    { status: "recorded" as const, count: 0 },
    { status: "edited" as const, count: 1 },
    { status: "published" as const, count: 3 },
  ];
  return {
    stages,
    total: stages.reduce((sum, stage) => sum + stage.count, 0),
    lateStageMoves: 2,
    ...overrides,
  };
}

describe("PipelineView", () => {
  it("shows every stage in pipeline order, not reordered by size", () => {
    render(<PipelineView snapshot={snapshot()} />);

    const labels = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(labels[0]).toContain("Idea");
    expect(labels[1]).toContain("Scripted");
    expect(labels[2]).toContain("Recorded");
    expect(labels[3]).toContain("Edited");
    expect(labels[4]).toContain("Published");
  });

  it("keeps an empty stage visible, as an honest zero", () => {
    render(<PipelineView snapshot={snapshot()} />);

    const recorded = screen
      .getAllByRole("listitem")
      .find((item) => item.textContent?.includes("Recorded"));
    expect(recorded?.textContent).toContain("0");
    expect(recorded?.querySelector("a")).toBeNull();
  });

  it("deep-links a stage that has ideas in it into the filtered ideas view", () => {
    render(<PipelineView snapshot={snapshot()} />);

    expect(screen.getByRole("link", { name: /Scripted/ })).toHaveAttribute(
      "href",
      "/content/ideas?status=scripted"
    );
  });

  it("reports late-stage movement, which is what makes a scripting-only month visible", () => {
    render(<PipelineView snapshot={snapshot({ lateStageMoves: 2 })} />);
    expect(
      screen.getByText("2 ideas reached recording or beyond this month.")
    ).toBeInTheDocument();
  });

  it("says nothing moved when nothing did, in the singular where it applies", () => {
    render(<PipelineView snapshot={snapshot({ lateStageMoves: 0 })} />);
    expect(
      screen.getByText("Nothing reached recording or beyond this month.")
    ).toBeInTheDocument();

    render(<PipelineView snapshot={snapshot({ lateStageMoves: 1 })} />);
    expect(
      screen.getByText("1 idea reached recording or beyond this month.")
    ).toBeInTheDocument();
  });

  it("invites a first idea when the pipeline is completely empty", () => {
    render(
      <PipelineView
        snapshot={snapshot({
          stages: [
            { status: "idea", count: 0 },
            { status: "scripted", count: 0 },
            { status: "recorded", count: 0 },
            { status: "edited", count: 0 },
            { status: "published", count: 0 },
          ],
          total: 0,
          lateStageMoves: 0,
        })}
      />
    );

    expect(
      screen.getByText(
        "Nothing in the pipeline. Capture an idea to get started."
      )
    ).toBeInTheDocument();
  });

  it("degrades to a message when the query failed", () => {
    render(<PipelineView snapshot={null} />);
    expect(screen.getByText("Couldn’t load the pipeline.")).toBeInTheDocument();
  });
});
