import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/improvements/actions", () => ({
  updateImprovementStatus: vi.fn(),
  recordImprovementOutcome: vi.fn(),
}));

import type { ImprovementSummary } from "@/lib/data/improvements";

import { ImprovementRow } from "./improvement-row";

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
    ...overrides,
  };
}

describe("ImprovementRow", () => {
  it("renders the title and status", () => {
    render(<ImprovementRow improvement={summary({ status: "discussed" })} />);
    expect(screen.getByText("Automate the changelog")).toBeInTheDocument();
    expect(
      screen.getByText("Discussed", { selector: '[data-slot="badge"]' })
    ).toBeInTheDocument();
  });

  it("shows the project chip when linked", () => {
    render(
      <ImprovementRow
        improvement={summary({
          projectId: "p-1",
          projectName: "Keystroke Hub",
        })}
      />
    );
    expect(screen.getByRole("link", { name: "Keystroke Hub" })).toHaveAttribute(
      "href",
      "/projects/p-1"
    );
  });

  it("shows the rationale snippet when present", () => {
    render(
      <ImprovementRow
        improvement={summary({ rationale: "Saves 20 minutes a release" })}
      />
    );
    expect(screen.getByText("Saves 20 minutes a release")).toBeInTheDocument();
  });

  it("shows the recorded outcome when present", () => {
    render(
      <ImprovementRow
        improvement={summary({ status: "done", outcome: "Shipped it" })}
      />
    );
    expect(screen.getByText("Shipped it")).toBeInTheDocument();
  });

  it("offers 'Record outcome' only while unresolved", () => {
    const { rerender } = render(
      <ImprovementRow improvement={summary({ status: "proposed" })} />
    );
    expect(
      screen.getByRole("button", { name: "Record outcome" })
    ).toBeInTheDocument();

    rerender(<ImprovementRow improvement={summary({ status: "done" })} />);
    expect(
      screen.queryByRole("button", { name: "Record outcome" })
    ).not.toBeInTheDocument();
  });
});
