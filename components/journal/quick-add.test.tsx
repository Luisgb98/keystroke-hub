import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const addItem = vi.hoisted(() => vi.fn());
vi.mock("@/lib/journal/actions", () => ({ addItem }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { QuickAdd } from "./quick-add";

describe("QuickAdd", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("adds an item on Enter and clears + refocuses the input", async () => {
    addItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <QuickAdd
        logDate="2026-07-08"
        placeholder="Add a plan…"
        ariaLabel="Add planned item"
      />
    );

    const input = screen.getByLabelText("Add planned item");
    await user.type(input, "Ship the feature{Enter}");

    await waitFor(() =>
      expect(addItem).toHaveBeenCalledWith(
        "2026-07-08",
        "Ship the feature",
        "planned"
      )
    );
    await waitFor(() => expect(input).toHaveValue(""));
    expect(input).toHaveFocus();
  });

  it("adds an item via the Add button with the given status", async () => {
    addItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <QuickAdd
        logDate="2026-07-08"
        status="done"
        placeholder="Log something done…"
        ariaLabel="Add done item"
      />
    );

    await user.type(screen.getByLabelText("Add done item"), "Fixed a bug");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(addItem).toHaveBeenCalledWith("2026-07-08", "Fixed a bug", "done")
    );
  });

  it("does not submit a blank title", async () => {
    const user = userEvent.setup();
    render(
      <QuickAdd
        logDate="2026-07-08"
        placeholder="Add a plan…"
        ariaLabel="Add planned item"
      />
    );

    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(addItem).not.toHaveBeenCalled();
  });

  it("toasts an error when the action fails", async () => {
    addItem.mockResolvedValue({ error: "That date isn't valid." });
    const user = userEvent.setup();
    render(
      <QuickAdd
        logDate="2026-07-08"
        placeholder="Add a plan…"
        ariaLabel="Add planned item"
      />
    );

    await user.type(
      screen.getByLabelText("Add planned item"),
      "Ship it{Enter}"
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That date isn't valid.")
    );
  });
});
