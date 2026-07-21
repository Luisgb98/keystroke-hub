import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const discardEntry = vi.hoisted(() => vi.fn());
const triageEntry = vi.hoisted(() => vi.fn());
vi.mock("@/lib/inbox/actions", () => ({ discardEntry, triageEntry }));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: toastError }),
}));

import { EntryCard } from "./entry-card";

const props = {
  id: "entry-1",
  body: "buy a new microphone",
  createdAt: new Date("2026-07-18T09:00:00Z"),
  today: "2026-07-18",
};

describe("EntryCard", () => {
  afterEach(() => vi.clearAllMocks());

  it("renders the captured body and a relative timestamp", () => {
    render(<EntryCard {...props} />);
    expect(screen.getByText("buy a new microphone")).toBeInTheDocument();
    expect(screen.getByRole("time")).toBeInTheDocument();
  });

  it("offers all four triage destinations", async () => {
    const user = userEvent.setup();
    render(<EntryCard {...props} />);

    await user.click(screen.getByRole("button", { name: "Triage" }));

    const menu = await screen.findByRole("menu");
    for (const label of [
      "Content idea",
      "Improvement",
      "Today's log",
      "Meeting note",
    ]) {
      expect(within(menu).getByRole("menuitem", { name: label })).toBeVisible();
    }
  });

  it("opens the triage dialog prefilled when a destination is chosen", async () => {
    const user = userEvent.setup();
    render(<EntryCard {...props} />);

    await user.click(screen.getByRole("button", { name: "Triage" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Content idea" })
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("buy a new microphone");
  });

  it("discards after confirmation", async () => {
    discardEntry.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<EntryCard {...props} />);

    await user.click(screen.getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Discard" }));

    await waitFor(() => expect(discardEntry).toHaveBeenCalledWith("entry-1"));
    expect(toastSuccess).toHaveBeenCalledWith("Discarded");
  });
});
