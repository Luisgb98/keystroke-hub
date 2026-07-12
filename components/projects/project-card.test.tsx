import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProjectSummary } from "@/lib/data/projects";

import { ProjectCard } from "./project-card";

function summary(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: "p-1",
    name: "Keystroke Hub",
    description: null,
    status: "active",
    archivedAt: null,
    linkedIdeaCount: 0,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("ProjectCard", () => {
  it("links to the project detail page", () => {
    render(<ProjectCard project={summary()} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/projects/p-1");
  });

  it("renders the name and status", () => {
    render(<ProjectCard project={summary({ status: "paused" })} />);
    expect(screen.getByText("Keystroke Hub")).toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
  });

  it("shows the description when present", () => {
    render(
      <ProjectCard project={summary({ description: "A personal app" })} />
    );
    expect(screen.getByText("A personal app")).toBeInTheDocument();
  });

  it("shows the linked-idea count only when greater than zero", () => {
    const { rerender } = render(
      <ProjectCard project={summary({ linkedIdeaCount: 0 })} />
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();

    rerender(<ProjectCard project={summary({ linkedIdeaCount: 3 })} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
