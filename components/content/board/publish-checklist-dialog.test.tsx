import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const getIdeaChecklistItems = vi.hoisted(() => vi.fn());
const toggleIdeaChecklistItem = vi.hoisted(() => vi.fn());
const addIdeaChecklistItem = vi.hoisted(() => vi.fn());
const removeIdeaChecklistItem = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/checklist-actions", () => ({
  getIdeaChecklistItems,
  toggleIdeaChecklistItem,
  addIdeaChecklistItem,
  removeIdeaChecklistItem,
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import type { IdeaChecklistItem } from "@/lib/db/schema";
import { PublishChecklistDialog } from "./publish-checklist-dialog";

function makeItem(
  overrides: Partial<IdeaChecklistItem> = {}
): IdeaChecklistItem {
  return {
    id: "item-1",
    ideaId: "idea-1",
    label: "Title",
    done: false,
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("PublishChecklistDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and renders items when opened", async () => {
    getIdeaChecklistItems.mockResolvedValue([
      makeItem({ label: "Title" }),
      makeItem({ id: "item-2", label: "Thumbnail" }),
    ]);
    render(
      <PublishChecklistDialog
        ideaId="idea-1"
        ideaTitle="Boss rush"
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(await screen.findByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Thumbnail")).toBeInTheDocument();
    expect(getIdeaChecklistItems).toHaveBeenCalledWith("idea-1");
  });

  it("does not fetch when closed", () => {
    render(
      <PublishChecklistDialog
        ideaId="idea-1"
        ideaTitle="Boss rush"
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    expect(getIdeaChecklistItems).not.toHaveBeenCalled();
  });

  it("toggles an item and calls toggleIdeaChecklistItem", async () => {
    getIdeaChecklistItems.mockResolvedValue([
      makeItem({ label: "Title", done: false }),
    ]);
    toggleIdeaChecklistItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <PublishChecklistDialog
        ideaId="idea-1"
        ideaTitle="Boss rush"
        open
        onOpenChange={vi.fn()}
      />
    );

    await user.click(await screen.findByLabelText("Title"));

    await waitFor(() =>
      expect(toggleIdeaChecklistItem).toHaveBeenCalledWith(
        "idea-1",
        "item-1",
        true
      )
    );
  });

  it("adds a new item and clears the input", async () => {
    getIdeaChecklistItems.mockResolvedValue([]);
    addIdeaChecklistItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <PublishChecklistDialog
        ideaId="idea-1"
        ideaTitle="Boss rush"
        open
        onOpenChange={vi.fn()}
      />
    );

    await screen.findByText("No checklist items yet.");
    await user.type(
      screen.getByLabelText("Add checklist item"),
      "Pin a comment"
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(addIdeaChecklistItem).toHaveBeenCalledWith(
        "idea-1",
        "Pin a comment"
      )
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Add checklist item")).toHaveValue("")
    );
  });

  it("removes an item", async () => {
    getIdeaChecklistItems.mockResolvedValue([makeItem({ label: "Title" })]);
    removeIdeaChecklistItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <PublishChecklistDialog
        ideaId="idea-1"
        ideaTitle="Boss rush"
        open
        onOpenChange={vi.fn()}
      />
    );

    await user.click(
      await screen.findByRole("button", { name: 'Remove "Title"' })
    );

    await waitFor(() =>
      expect(removeIdeaChecklistItem).toHaveBeenCalledWith("idea-1", "item-1")
    );
  });

  it("toasts an error when a toggle fails", async () => {
    getIdeaChecklistItems.mockResolvedValue([makeItem({ label: "Title" })]);
    toggleIdeaChecklistItem.mockResolvedValue({
      error: "That checklist item no longer exists.",
    });
    const user = userEvent.setup();
    render(
      <PublishChecklistDialog
        ideaId="idea-1"
        ideaTitle="Boss rush"
        open
        onOpenChange={vi.fn()}
      />
    );

    await user.click(await screen.findByLabelText("Title"));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "That checklist item no longer exists."
      )
    );
  });
});
