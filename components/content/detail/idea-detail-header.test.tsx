import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const deleteIdea = vi.hoisted(() => vi.fn());
const updateIdea = vi.hoisted(() => vi.fn());
const createIdea = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/actions", () => ({
  deleteIdea,
  updateIdea,
  createIdea,
}));

const toastFn = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(toastFn, { success: toastSuccess, error: toastError }),
}));

import type { Idea } from "@/lib/db/schema";
import { IdeaDetailHeader } from "./idea-detail-header";

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    title: "Speedrun any% commentary",
    notes: null,
    format: "video",
    status: "idea",
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

describe("IdeaDetailHeader", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the idea's format", () => {
    render(
      <IdeaDetailHeader
        idea={makeIdea({ format: "stream" })}
        releaseStartsAt={null}
        hasScript={false}
        hasScheduledEvents={false}
      />
    );
    expect(screen.getByText("Stream")).toBeInTheDocument();
  });

  it("opens the editor prefilled when the pencil is clicked", async () => {
    const user = userEvent.setup();
    render(
      <IdeaDetailHeader
        idea={makeIdea({ title: "Boss rush" })}
        releaseStartsAt={null}
        hasScript={false}
        hasScheduledEvents={false}
      />
    );

    await user.click(screen.getByRole("button", { name: 'Edit "Boss rush"' }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Edit idea")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Title")).toHaveValue("Boss rush");
  });

  it("warns the script is deleted too when one exists", async () => {
    const user = userEvent.setup();
    render(
      <IdeaDetailHeader
        idea={makeIdea({ title: "Boss rush" })}
        releaseStartsAt={null}
        hasScript
        hasScheduledEvents={false}
      />
    );

    await user.click(
      screen.getByRole("button", { name: 'Delete "Boss rush"' })
    );
    expect(
      screen.getByText(/Its script will be deleted too\./)
    ).toBeInTheDocument();
  });

  it("deletes and navigates back to the ideas list on confirm", async () => {
    deleteIdea.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <IdeaDetailHeader
        idea={makeIdea({ id: "idea-7", title: "Old idea" })}
        releaseStartsAt={null}
        hasScript={false}
        hasScheduledEvents={false}
      />
    );

    await user.click(screen.getByRole("button", { name: 'Delete "Old idea"' }));
    const confirm = screen.getByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteIdea).toHaveBeenCalledWith("idea-7"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/content/ideas"));
  });
});
