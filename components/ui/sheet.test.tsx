import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./sheet";

function Example() {
  return (
    <Sheet>
      <SheetTrigger>Open</SheetTrigger>
      <SheetContent>
        <SheetTitle>Choices</SheetTitle>
        <button type="button">A choice</button>
      </SheetContent>
    </Sheet>
  );
}

describe("Sheet", () => {
  it("opens from its trigger and traps the content in a dialog", async () => {
    const user = userEvent.setup();
    render(<Example />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName("Choices");
  });

  it("closes on Escape, like every other modal in the app", async () => {
    // It's the same Base UI primitive as `dialog.tsx` — docked to the bottom
    // edge rather than centred — so dismissal has to behave identically.
    const user = userEvent.setup();
    render(<Example />);

    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("docks to the bottom edge and pads past the home indicator", async () => {
    // The whole reason this exists next to `Dialog`: a phone-native sheet
    // opens under the thumb, and its last row has to clear the safe area
    // (#114 — paired with the root layout's `viewportFit: "cover"`).
    const user = userEvent.setup();
    render(<Example />);

    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = await screen.findByRole("dialog");

    expect(dialog).toHaveClass("bottom-0");
    expect(dialog).toHaveClass("pb-[calc(1rem+env(safe-area-inset-bottom))]");
  });

  it("renders a decorative grab handle that screen readers skip", async () => {
    const user = userEvent.setup();
    render(<Example />);

    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");

    const handle = document.querySelector('[data-slot="sheet-handle"]');
    expect(handle).not.toBeNull();
    expect(handle).toHaveAttribute("aria-hidden");
  });
});
