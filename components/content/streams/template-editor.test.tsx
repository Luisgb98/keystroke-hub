import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const addTemplateItem = vi.hoisted(() => vi.fn());
const removeTemplateItem = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/stream-actions", () => ({
  addTemplateItem,
  removeTemplateItem,
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import type { StreamChecklistTemplateItem } from "@/lib/db/schema";
import { TemplateEditor } from "./template-editor";

function makeItem(
  overrides: Partial<StreamChecklistTemplateItem> = {}
): StreamChecklistTemplateItem {
  return {
    id: "t-1",
    label: "Check mic",
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("TemplateEditor", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens the dialog and shows an empty state with no items", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor items={[]} />);
    await user.click(screen.getByRole("button", { name: "Default checklist" }));

    expect(screen.getByText("No default items yet.")).toBeInTheDocument();
  });

  it("lists existing template items", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor items={[makeItem({ label: "Check mic" })]} />);
    await user.click(screen.getByRole("button", { name: "Default checklist" }));

    expect(screen.getByText("Check mic")).toBeInTheDocument();
  });

  it("adds a new template item", async () => {
    addTemplateItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(<TemplateEditor items={[]} />);
    await user.click(screen.getByRole("button", { name: "Default checklist" }));

    await user.type(
      screen.getByLabelText("Add default checklist item"),
      "Test scene"
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(addTemplateItem).toHaveBeenCalledWith("Test scene")
    );
  });

  it("removes a template item", async () => {
    removeTemplateItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(<TemplateEditor items={[makeItem({ label: "Check mic" })]} />);
    await user.click(screen.getByRole("button", { name: "Default checklist" }));

    await user.click(
      screen.getByRole("button", { name: 'Remove "Check mic"' })
    );

    await waitFor(() => expect(removeTemplateItem).toHaveBeenCalledWith("t-1"));
  });

  it("toasts an error when adding fails", async () => {
    addTemplateItem.mockResolvedValue({ error: "Label is required" });
    const user = userEvent.setup();
    render(<TemplateEditor items={[]} />);
    await user.click(screen.getByRole("button", { name: "Default checklist" }));
    await user.type(screen.getByLabelText("Add default checklist item"), "x");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Label is required")
    );
  });
});
