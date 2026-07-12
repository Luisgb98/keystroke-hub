import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const updateIdeaStatus = vi.hoisted(() => vi.fn());
const deleteIdea = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/actions", () => ({ updateIdeaStatus, deleteIdea }));

const toastFn = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(toastFn, { success: toastSuccess, error: toastError }),
}));

import type { Idea } from "@/lib/db/schema";
import { IdeaCard } from "./idea-card";

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    title: "Speedrun any% commentary",
    notes: null,
    format: "either",
    status: "spark",
    tags: [],
    projectId: null,
    stageEnteredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("IdeaCard", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("links the script action to the idea's script page", () => {
    render(<IdeaCard idea={makeIdea({ id: "idea-9", title: "Boss rush" })} />);
    const link = screen.getByRole("link", {
      name: 'Write script for "Boss rush"',
    });
    expect(link).toHaveAttribute("href", "/content/ideas/idea-9/script");
  });

  it("labels the script action as 'Open' once a script exists", () => {
    render(
      <IdeaCard
        idea={makeIdea({ id: "idea-9", title: "Boss rush" })}
        hasScript
      />
    );
    expect(
      screen.getByRole("link", { name: 'Open script for "Boss rush"' })
    ).toBeInTheDocument();
  });

  it("renders the title, format, and tags", () => {
    render(
      <IdeaCard
        idea={makeIdea({ format: "video", tags: ["speedrun", "glitch"] })}
      />
    );

    expect(screen.getByText("Speedrun any% commentary")).toBeInTheDocument();
    expect(screen.getByText("Video")).toBeInTheDocument();
    expect(screen.getByText("speedrun")).toBeInTheDocument();
    expect(screen.getByText("glitch")).toBeInTheDocument();
  });

  it("renders notes when present, and omits the block when absent", () => {
    const { rerender } = render(
      <IdeaCard idea={makeIdea({ notes: "Cover the wrong warp" })} />
    );
    expect(screen.getByText("Cover the wrong warp")).toBeInTheDocument();

    rerender(<IdeaCard idea={makeIdea({ notes: null })} />);
    expect(screen.queryByText("Cover the wrong warp")).not.toBeInTheDocument();
  });

  it("shows the idea's current status in the status control", () => {
    render(<IdeaCard idea={makeIdea({ status: "outlined" })} />);
    expect(screen.getByLabelText("Status")).toHaveValue("outlined");
  });

  it("changes status and calls updateIdeaStatus", async () => {
    updateIdeaStatus.mockResolvedValue({});
    const user = userEvent.setup();
    render(<IdeaCard idea={makeIdea({ id: "idea-42", status: "spark" })} />);

    await user.selectOptions(screen.getByLabelText("Status"), "outlined");

    await waitFor(() =>
      expect(updateIdeaStatus).toHaveBeenCalledWith("idea-42", "outlined")
    );
  });

  it("toasts an error without reverting the select when the status update fails", async () => {
    updateIdeaStatus.mockResolvedValue({
      error: "That idea no longer exists.",
    });
    const user = userEvent.setup();
    render(<IdeaCard idea={makeIdea()} />);

    await user.selectOptions(screen.getByLabelText("Status"), "parked");

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That idea no longer exists.")
    );
  });

  it("nudges with a plain toast when publishing leaves items unchecked", async () => {
    updateIdeaStatus.mockResolvedValue({ uncheckedCount: 2 });
    const user = userEvent.setup();
    render(<IdeaCard idea={makeIdea({ status: "edited" })} />);

    await user.selectOptions(screen.getByLabelText("Status"), "published");

    await waitFor(() =>
      expect(toastFn).toHaveBeenCalledWith(
        "Published with 2 unchecked checklist items"
      )
    );
  });

  it("does not nudge when publishing with everything checked", async () => {
    updateIdeaStatus.mockResolvedValue({ uncheckedCount: 0 });
    const user = userEvent.setup();
    render(<IdeaCard idea={makeIdea({ status: "edited" })} />);

    await user.selectOptions(screen.getByLabelText("Status"), "published");

    await waitFor(() =>
      expect(updateIdeaStatus).toHaveBeenCalledWith(
        expect.any(String),
        "published"
      )
    );
    expect(toastFn).not.toHaveBeenCalled();
  });

  it("shows a project chip linking to the project when one is provided", () => {
    render(
      <IdeaCard
        idea={makeIdea()}
        project={{ id: "project-1", name: "Keystroke Hub" }}
      />
    );
    const link = screen.getByRole("link", { name: "Keystroke Hub" });
    expect(link).toHaveAttribute("href", "/projects/project-1");
  });

  it("omits the project chip when no project is linked", () => {
    render(<IdeaCard idea={makeIdea()} />);
    expect(
      screen.queryByRole("link", { name: /project/i })
    ).not.toBeInTheDocument();
  });

  it("opens a delete confirmation and calls deleteIdea on confirm", async () => {
    deleteIdea.mockResolvedValue({});
    const user = userEvent.setup();
    render(<IdeaCard idea={makeIdea({ id: "idea-7", title: "Old idea" })} />);

    await user.click(screen.getByRole("button", { name: 'Delete "Old idea"' }));
    const confirm = screen.getByRole("alertdialog");
    expect(confirm).toBeVisible();

    await user.click(within(confirm).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteIdea).toHaveBeenCalledWith("idea-7"));
  });

  it("warns that the script is deleted too when the idea has one", async () => {
    const user = userEvent.setup();
    render(<IdeaCard idea={makeIdea({ title: "Old idea" })} hasScript />);

    await user.click(screen.getByRole("button", { name: 'Delete "Old idea"' }));

    expect(
      screen.getByText(/Its script will be deleted too\./)
    ).toBeInTheDocument();
  });
});
