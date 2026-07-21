import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/improvements/actions", () => ({
  updateImprovementStatus: vi.fn(),
  recordImprovementOutcome: vi.fn(),
}));

import type { ImprovementSummary } from "@/lib/data/improvements";

import { AgendaTabs } from "./agenda-tabs";

function summary(
  overrides: Partial<ImprovementSummary> = {}
): ImprovementSummary {
  return {
    id: "i-1",
    title: "Automate the changelog",
    rationale: null,
    status: "proposed",
    outcome: null,
    projectId: null,
    projectName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    githubIssueLinks: [],
    ...overrides,
  };
}

describe("AgendaTabs", () => {
  it("defaults to the Agenda tab", () => {
    render(<AgendaTabs overview={{ agenda: [summary()], all: [summary()] }} />);
    expect(screen.getByText("Automate the changelog")).toBeInTheDocument();
  });

  it("shows the empty-agenda message when nothing is waiting", () => {
    render(<AgendaTabs overview={{ agenda: [], all: [] }} />);
    expect(
      screen.getByText("Nothing waiting for the next meeting 🎉")
    ).toBeInTheDocument();
  });

  it("switches to the All tab and shows resolved items too", async () => {
    const resolved = summary({
      id: "i-2",
      title: "Already shipped",
      status: "done",
    });
    const user = userEvent.setup();
    render(
      <AgendaTabs
        overview={{ agenda: [summary()], all: [summary(), resolved] }}
      />
    );

    expect(screen.queryByText("Already shipped")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "All (2)" }));

    expect(screen.getByText("Already shipped")).toBeInTheDocument();
  });
});
