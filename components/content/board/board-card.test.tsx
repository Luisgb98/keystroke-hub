import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Idea } from "@/lib/db/schema";

import { BoardCard } from "./board-card";

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    title: "Speedrun any% commentary",
    notes: null,
    format: "video",
    status: "scripted",
    tags: [],
    projectId: null,
    stageEnteredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("BoardCard", () => {
  it("renders the title and format", () => {
    render(<BoardCard idea={makeIdea()} onMove={vi.fn()} />);
    expect(screen.getByText("Speedrun any% commentary")).toBeInTheDocument();
    expect(screen.getByText("Video")).toBeInTheDocument();
  });

  it("shows the absolute stage-entry time in a title attribute", () => {
    const stageEnteredAt = new Date("2026-07-01T12:00:00Z");
    render(<BoardCard idea={makeIdea({ stageEnteredAt })} onMove={vi.fn()} />);
    const chip = screen.getByTitle(stageEnteredAt.toLocaleString());
    expect(chip).toBeInTheDocument();
  });

  it("calls onMove with the idea and the chosen stage", async () => {
    const onMove = vi.fn();
    const user = userEvent.setup();
    const idea = makeIdea({ status: "scripted" });
    render(<BoardCard idea={idea} onMove={onMove} />);

    await user.click(
      screen.getByRole("button", { name: `Move "${idea.title}"` })
    );
    await user.click(await screen.findByText("Recorded"));

    expect(onMove).toHaveBeenCalledWith(idea, "recorded");
  });

  it("links the script action to the idea's script page", () => {
    const idea = makeIdea({ id: "idea-9", title: "Boss rush" });
    render(<BoardCard idea={idea} onMove={vi.fn()} />);

    const link = screen.getByRole("link", {
      name: 'Write script for "Boss rush"',
    });
    expect(link).toHaveAttribute("href", "/content/ideas/idea-9/script");
  });

  it("labels the script action as 'Open' once a script exists", () => {
    const idea = makeIdea({ id: "idea-9", title: "Boss rush" });
    render(<BoardCard idea={idea} onMove={vi.fn()} hasScript />);

    expect(
      screen.getByRole("link", { name: 'Open script for "Boss rush"' })
    ).toBeInTheDocument();
  });
});
