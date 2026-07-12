import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProjectImprovementSummary } from "@/lib/data/improvements";

import { ProjectImprovements } from "./project-improvements";

describe("ProjectImprovements", () => {
  it("shows an empty state when nothing is linked", () => {
    render(<ProjectImprovements improvements={[]} />);
    expect(screen.getByText("No improvements linked yet.")).toBeInTheDocument();
  });

  it("lists linked improvements with their status", () => {
    const improvements: ProjectImprovementSummary[] = [
      { id: "i-1", title: "Automate the changelog", status: "proposed" },
    ];
    render(<ProjectImprovements improvements={improvements} />);
    expect(screen.getByText("Automate the changelog")).toBeInTheDocument();
    expect(screen.getByText("Proposed")).toBeInTheDocument();
  });

  it("links to the full backlog", () => {
    render(<ProjectImprovements improvements={[]} />);
    expect(screen.getByRole("link", { name: "Open backlog" })).toHaveAttribute(
      "href",
      "/projects/improvements"
    );
  });
});
