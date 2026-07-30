import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setOpen = vi.hoisted(() => vi.fn());
vi.mock("@/components/command-palette/command-palette-provider", () => ({
  useCommandPalette: () => ({ open: false, setOpen }),
}));

import { BOTTOM_NAV_ITEM_CLASSES } from "@/components/shell/nav-link";

import { PaletteSearchButton, PaletteTriggerChip } from "./palette-trigger";

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

  it("renders on the shared button system rather than a one-off surface", () => {
    // #84's button pass: the chip used to hand-roll its own border, surface and
    // hover, so it drifted from every other button. It's an outline Button now.
    render(<PaletteTriggerChip />);
    const trigger = screen.getByRole("button", { name: "Search" });

    expect(trigger).toHaveAttribute("data-slot", "button");
    expect(trigger).toHaveClass("focus-visible:ring-ring/50");
  });
});

describe("PaletteSearchButton", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens the palette when tapped", () => {
    render(<PaletteSearchButton />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(setOpen).toHaveBeenCalledWith(true);
  });

  it("reuses NavLink's bottom-nav item classes instead of restating them", () => {
    // It sits in the same row as the nav links; a copied class string would
    // silently drift from them (#84).
    render(<PaletteSearchButton />);
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute(
      "class",
      BOTTOM_NAV_ITEM_CLASSES
    );
  });
});
