import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setOpen = vi.hoisted(() => vi.fn());
vi.mock("@/components/command-palette/command-palette-provider", () => ({
  useCommandPalette: () => ({ open: false, setOpen }),
}));

import { PaletteTriggerChip } from "./palette-trigger";

describe("PaletteTriggerChip", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens the palette when clicked", () => {
    render(<PaletteTriggerChip />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(setOpen).toHaveBeenCalledWith(true);
  });

  it("shows a Ctrl K hint by default (non-Mac user agent in jsdom)", () => {
    render(<PaletteTriggerChip />);
    expect(screen.getByText("CtrlK")).toBeInTheDocument();
  });

  // #102 handed Cmd/Ctrl-F back to the browser for find-in-page inside scripts,
  // so the chip must not keep pointing at a combo the app no longer answers.
  it("no longer advertises the retired Ctrl F shortcut (#102)", () => {
    render(<PaletteTriggerChip />);
    expect(screen.queryByText("CtrlF")).not.toBeInTheDocument();
  });

  it("renders on the shared button system rather than a one-off surface", () => {
    // #84's button pass: the chip used to hand-roll its own border, surface and
    // hover, so it drifted from every other button. It's an outline Button now.
    render(<PaletteTriggerChip />);
    const trigger = screen.getByRole("button", { name: "Search" });

    expect(trigger).toHaveAttribute("data-slot", "button");
    expect(trigger).toHaveClass("focus-visible:ring-ring/50");
  });
});
