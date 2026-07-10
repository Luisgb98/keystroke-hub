import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const toggleItem = vi.hoisted(() => vi.fn());
const deleteItem = vi.hoisted(() => vi.fn());
const rolloverItem = vi.hoisted(() => vi.fn());
const rolloverAllUnfinished = vi.hoisted(() => vi.fn());
vi.mock("@/lib/journal/actions", () => ({
  toggleItem,
  deleteItem,
  rolloverItem,
  rolloverAllUnfinished,
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import type { DailyLogItem } from "@/lib/db/schema";
import { ItemList } from "./item-list";

function makeItem(overrides: Partial<DailyLogItem> = {}): DailyLogItem {
  return {
    id: "item-1",
    logId: "log-1",
    title: "Ship the feature",
    status: "planned",
    rolledOverToId: null,
    position: 0,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("ItemList", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty states with no items", () => {
    render(<ItemList logDate="2026-07-08" items={[]} />);
    expect(screen.getByText("Nothing planned yet.")).toBeInTheDocument();
    expect(screen.getByText("Nothing done yet.")).toBeInTheDocument();
  });

  it("splits items into planned and done sections", () => {
    render(
      <ItemList
        logDate="2026-07-08"
        items={[
          makeItem({ id: "i-1", title: "Planned thing", status: "planned" }),
          makeItem({ id: "i-2", title: "Done thing", status: "done" }),
        ]}
      />
    );
    expect(screen.getByText("Planned thing")).toBeInTheDocument();
    expect(screen.getByText("Done thing")).toBeInTheDocument();
  });

  it("shows rolled-over items struck through with a marker", () => {
    render(
      <ItemList
        logDate="2026-07-08"
        items={[
          makeItem({ id: "i-1", title: "Rolled thing", status: "rolled_over" }),
        ]}
      />
    );
    expect(screen.getByText("Rolled thing")).toHaveClass("line-through");
    expect(screen.getByText("→ rolled")).toBeInTheDocument();
  });

  it("checking off a planned item calls toggleItem(true)", async () => {
    toggleItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <ItemList
        logDate="2026-07-08"
        items={[makeItem({ id: "i-1", title: "Planned thing" })]}
      />
    );

    await user.click(screen.getByLabelText("Planned thing"));

    await waitFor(() => expect(toggleItem).toHaveBeenCalledWith("i-1", true));
  });

  it("unchecking a done item calls toggleItem(false)", async () => {
    toggleItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <ItemList
        logDate="2026-07-08"
        items={[makeItem({ id: "i-1", title: "Done thing", status: "done" })]}
      />
    );

    await user.click(screen.getByLabelText("Done thing"));

    await waitFor(() => expect(toggleItem).toHaveBeenCalledWith("i-1", false));
  });

  it("removes an item", async () => {
    deleteItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <ItemList
        logDate="2026-07-08"
        items={[makeItem({ id: "i-1", title: "Planned thing" })]}
      />
    );

    await user.click(
      screen.getByRole("button", { name: 'Remove "Planned thing"' })
    );

    await waitFor(() => expect(deleteItem).toHaveBeenCalledWith("i-1"));
  });

  it("rolls a single planned item over to tomorrow", async () => {
    rolloverItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <ItemList
        logDate="2026-07-08"
        items={[makeItem({ id: "i-1", title: "Planned thing" })]}
      />
    );

    await user.click(
      screen.getByRole("button", {
        name: 'Roll "Planned thing" over to tomorrow',
      })
    );

    await waitFor(() =>
      expect(rolloverItem).toHaveBeenCalledWith("i-1", "2026-07-08")
    );
  });

  it("shows and triggers 'roll over all unfinished' only when planned items exist", async () => {
    rolloverAllUnfinished.mockResolvedValue({});
    const user = userEvent.setup();
    const { rerender } = render(
      <ItemList
        logDate="2026-07-08"
        items={[makeItem({ id: "i-1", title: "Planned thing" })]}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Roll over all unfinished" })
    );
    await waitFor(() =>
      expect(rolloverAllUnfinished).toHaveBeenCalledWith("2026-07-08")
    );

    rerender(<ItemList logDate="2026-07-08" items={[]} />);
    expect(
      screen.queryByRole("button", { name: "Roll over all unfinished" })
    ).not.toBeInTheDocument();
  });

  it("toasts an error when a toggle fails", async () => {
    toggleItem.mockResolvedValue({ error: "That item no longer exists." });
    const user = userEvent.setup();
    render(
      <ItemList
        logDate="2026-07-08"
        items={[makeItem({ id: "i-1", title: "Planned thing" })]}
      />
    );

    await user.click(screen.getByLabelText("Planned thing"));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That item no longer exists.")
    );
  });
});
