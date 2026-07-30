import { render, screen } from "@testing-library/react";
import { format } from "date-fns";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/content/actions", () => ({
  updateIdeaStatus: vi.fn(),
  deleteIdea: vi.fn(),
  createIdea: vi.fn(),
  updateIdea: vi.fn(),
}));

vi.mock("@/lib/content/link-actions", () => ({
  linkIdeaToEvent: vi.fn(),
  unlinkIdeaFromEvent: vi.fn(),
}));

vi.mock("@/lib/content/script-actions", () => ({ saveScript: vi.fn() }));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import type { Idea, Script } from "@/lib/db/schema";
import type { ScheduledEventSummary } from "@/lib/data/idea-event-links";
import { IdeaDetail } from "./idea-detail";

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    title: "Speedrun any% commentary",
    notes: null,
    format: "video",
    status: "scripted",
    tags: [],
    projectId: null,
    releaseEventId: null,
    releaseEventTrack: null,
    stageEnteredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeScript(overrides: Partial<Script> = {}): Script {
  return {
    id: "script-1",
    ideaId: "idea-1",
    content: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("IdeaDetail", () => {
  it("renders the title, format, status, and tags", () => {
    render(
      <IdeaDetail
        idea={makeIdea({ format: "video", tags: ["speedrun", "glitch"] })}
        script={null}
        scheduledEvents={[]}
      />
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Speedrun any% commentary",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Video")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveTextContent(
      "Scripted"
    );
    expect(screen.getByText("speedrun")).toBeInTheDocument();
    expect(screen.getByText("glitch")).toBeInTheDocument();
  });

  it("preserves paragraph breaks in the description", () => {
    render(
      <IdeaDetail
        idea={makeIdea({ notes: "First beat.\n\nSecond beat." })}
        script={null}
        scheduledEvents={[]}
      />
    );

    const paragraph = screen.getByText(/First beat/);
    expect(paragraph).toHaveTextContent("First beat.");
    expect(paragraph).toHaveTextContent("Second beat.");
    expect(paragraph).toHaveClass("whitespace-pre-line");
  });

  it("shows the release date and time from the linked release event", () => {
    const startsAt = new Date("2026-08-01T17:00:00Z");
    const releaseEvent: ScheduledEventSummary = {
      id: "event-1",
      title: "Release: Speedrun any% commentary",
      startsAt,
      endsAt: new Date("2026-08-01T18:00:00Z"),
      allDay: false,
    };
    render(
      <IdeaDetail
        idea={makeIdea({
          releaseEventId: "event-1",
          releaseEventTrack: "content",
        })}
        script={null}
        scheduledEvents={[releaseEvent]}
      />
    );

    expect(
      screen.getByText(format(startsAt, "MMM d, yyyy · HH:mm"))
    ).toBeInTheDocument();
  });

  it("shows a tags-incomplete counter until the five-tag standard is met", () => {
    render(
      <IdeaDetail
        idea={makeIdea({ tags: ["speedrun", "glitch"] })}
        script={null}
        scheduledEvents={[]}
      />
    );
    expect(screen.getByText("2/5")).toBeInTheDocument();
  });

  it("links to the project when one is provided", () => {
    render(
      <IdeaDetail
        idea={makeIdea()}
        script={null}
        scheduledEvents={[]}
        project={{ id: "project-1", name: "Keystroke Hub" }}
      />
    );
    expect(screen.getByRole("link", { name: "Keystroke Hub" })).toHaveAttribute(
      "href",
      "/projects/project-1"
    );
  });

  it("exposes the four publish copy blocks", () => {
    render(
      <IdeaDetail
        idea={makeIdea({ tags: ["a", "b", "c", "d", "e"] })}
        script={null}
        scheduledEvents={[]}
      />
    );
    for (const name of [
      "Copy Title",
      "Copy Title + tags",
      "Copy Description + tags",
      "Copy Tags",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("renders the script read-only with an explicit Edit control", () => {
    render(
      <IdeaDetail
        idea={makeIdea()}
        script={makeScript({ content: "# Cold open" })}
        scheduledEvents={[]}
      />
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Cold open" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Script")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });
});
