import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/projects/actions", () => ({
  linkIdeaToProject: vi.fn(),
  unlinkIdeaFromProject: vi.fn(),
  searchLinkableIdeas: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

import type { LinkedIdeaSummary } from "@/lib/data/projects";
import { ProjectLinkedIdeas } from "./project-linked-ideas";

function makeIdea(
  overrides: Partial<LinkedIdeaSummary> = {}
): LinkedIdeaSummary {
  return {
    id: "idea-1",
    title: "Speedrun any% commentary",
    format: "video",
    status: "idea",
    ...overrides,
  };
}

describe("ProjectLinkedIdeas", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty-state message when nothing is linked", () => {
    render(<ProjectLinkedIdeas projectId="proj-1" linkedIdeas={[]} />);
    expect(screen.getByText("No ideas linked yet.")).toBeInTheDocument();
  });

  it("links each title straight to the idea's detail page (#123)", () => {
    // Same fix as `EventLinkedIdeas`: the `?q=` search detour predates the
    // detail page and cost a second tap on every visit.
    render(
      <ProjectLinkedIdeas
        projectId="proj-1"
        linkedIdeas={[
          makeIdea({ id: "idea-9", title: "Boss rush", status: "scripted" }),
        ]}
      />
    );
    expect(screen.getByText("Boss rush").closest("a")).toHaveAttribute(
      "href",
      "/content/ideas/idea-9"
    );
    expect(screen.getByText("Scripted")).toBeInTheDocument();
  });

  it("hides the unlink action while the project is archived", () => {
    render(
      <ProjectLinkedIdeas
        projectId="proj-1"
        linkedIdeas={[makeIdea({ title: "Boss rush" })]}
        disabled
      />
    );
    expect(
      screen.queryByRole("button", { name: 'Unlink "Boss rush"' })
    ).not.toBeInTheDocument();
  });
});
