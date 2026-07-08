import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IdeaEmptyState } from "./idea-empty-state";

describe("IdeaEmptyState", () => {
  it("shows a first-capture invitation when there are no active filters", () => {
    render(<IdeaEmptyState hasActiveFilters={false} />);
    expect(screen.getByText("Capture your first idea")).toBeInTheDocument();
  });

  it("shows a 'no matches' state when filters/search produced zero results", () => {
    render(<IdeaEmptyState hasActiveFilters />);
    expect(screen.getByText("No matching ideas")).toBeInTheDocument();
  });
});
