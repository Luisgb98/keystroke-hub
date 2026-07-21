import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const toggleChecklistItem = vi.hoisted(() => vi.fn());
const addChecklistItem = vi.hoisted(() => vi.fn());
const removeChecklistItem = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/stream-actions", () => ({
  toggleChecklistItem,
  addChecklistItem,
  removeChecklistItem,
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import type { StreamChecklistItem } from "@/lib/db/schema";
import { StreamChecklist } from "./stream-checklist";

function makeItem(
  overrides: Partial<StreamChecklistItem> = {}
): StreamChecklistItem {
  return {
    id: "item-1",
    streamId: "stream-1",
    label: "Check mic",
    done: false,
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("StreamChecklist", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty state with no items", () => {
    render(<StreamChecklist streamId="stream-1" items={[]} />);
    expect(screen.getByText("No checklist items yet.")).toBeInTheDocument();
  });

  it("renders each item's label", () => {
    render(
      <StreamChecklist
        streamId="stream-1"
        items={[
          makeItem({ label: "Check mic" }),
          makeItem({ label: "Test scene", id: "item-2" }),
        ]}
      />
    );
    expect(screen.getByText("Check mic")).toBeInTheDocument();
    expect(screen.getByText("Test scene")).toBeInTheDocument();
  });

  it("toggles an item and calls toggleChecklistItem", async () => {
    toggleChecklistItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <StreamChecklist
        streamId="stream-1"
        items={[makeItem({ id: "item-5", label: "Check mic", done: false })]}
      />
    );

    await user.click(screen.getByLabelText("Check mic"));

    await waitFor(() =>
      expect(toggleChecklistItem).toHaveBeenCalledWith(
        "stream-1",
        "item-5",
        true
      )
    );
  });

  it("adds a new item and clears the input", async () => {
    addChecklistItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(<StreamChecklist streamId="stream-1" items={[]} />);

    await user.type(
      screen.getByLabelText("Add checklist item"),
      "Warm up voice"
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(addChecklistItem).toHaveBeenCalledWith("stream-1", "Warm up voice")
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Add checklist item")).toHaveValue("")
    );
  });

  it("removes an item", async () => {
    removeChecklistItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <StreamChecklist
        streamId="stream-1"
        items={[makeItem({ id: "item-3", label: "Check mic" })]}
      />
    );

    await user.click(
      screen.getByRole("button", { name: 'Remove "Check mic"' })
    );

    await waitFor(() =>
      expect(removeChecklistItem).toHaveBeenCalledWith("stream-1", "item-3")
    );
  });

  it("toasts an error when a toggle fails", async () => {
    toggleChecklistItem.mockResolvedValue({
      error: "That checklist item no longer exists.",
    });
    const user = userEvent.setup();
    render(
      <StreamChecklist
        streamId="stream-1"
        items={[makeItem({ label: "Check mic" })]}
      />
    );

    await user.click(screen.getByLabelText("Check mic"));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "That checklist item no longer exists."
      )
    );
  });
});
