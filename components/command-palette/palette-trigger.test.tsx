import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setOpen = vi.hoisted(() => vi.fn());
vi.mock("@/components/command-palette/command-palette-provider", () => ({
  useCommandPalette: () => ({ open: false, setOpen }),
}));

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
});
