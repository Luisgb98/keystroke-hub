import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

function Example({ variant }: { variant?: "centered" | "sheet" }) {
  return (
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent variant={variant}>
        <form>
          <DialogHeader>
            <DialogTitle>New idea</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <input aria-label="Title" />
          </DialogBody>
          <DialogFooter>
            <button type="submit">Save</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

async function open(variant?: "centered" | "sheet") {
  const user = userEvent.setup();
  render(<Example variant={variant} />);
  await user.click(screen.getByRole("button", { name: "Open" }));
  return screen.findByRole("dialog");
}

describe("DialogContent", () => {
  it("stays a centred panel by default", async () => {
    // Every dialog that isn't form-shaped keeps the behavior it had before
    // #114 — the variant is opt-in, not a sweeping restyle.
    const dialog = await open();
    expect(dialog).toHaveAttribute("data-variant", "centered");
    expect(dialog).toHaveClass("top-1/2");
    expect(dialog).toHaveClass("left-1/2");
  });

  it("docks the sheet variant to the bottom edge on a phone", async () => {
    const dialog = await open("sheet");
    expect(dialog).toHaveAttribute("data-variant", "sheet");
    expect(dialog).toHaveClass("bottom-0");
    expect(dialog).toHaveClass("inset-x-0");
    expect(dialog).toHaveClass("rounded-t-2xl");
  });

  it("returns the sheet variant to a centred panel from md up", async () => {
    // The desktop design doesn't change: same centred dialog, same width cap.
    const dialog = await open("sheet");
    expect(dialog).toHaveClass("md:top-1/2");
    expect(dialog).toHaveClass("md:bottom-auto");
    expect(dialog).toHaveClass("md:max-w-md");
    expect(dialog).toHaveClass("md:rounded-xl");
  });

  it("caps the sheet in svh, not dvh", async () => {
    // A mobile browser's collapsing toolbar changes `dvh` mid-scroll, which
    // would let it push the pinned footer off-screen.
    const dialog = await open("sheet");
    expect(dialog).toHaveClass("max-h-[92svh]");
  });

  it("zeroes the min-size floor on its children", async () => {
    // A grid/flex item's `min-width: auto` floors it at its own min-content
    // width, so one long unbreakable string could paint outside the panel
    // (#102). `min-h-0` is the vertical twin — it's what lets `DialogBody`
    // scroll instead of stretching the sheet past the viewport.
    const dialog = await open("sheet");
    expect(dialog).toHaveClass("[&>*]:min-w-0");
    expect(dialog).toHaveClass("[&>*]:min-h-0");
  });
});

describe("DialogBody", () => {
  it("is the only part that scrolls", async () => {
    await open("sheet");
    const body = document.querySelector('[data-slot="dialog-body"]');
    expect(body).toHaveClass("overflow-y-auto");
    expect(body).toHaveClass("flex-1");
    expect(body).toHaveClass("min-h-0");
  });

  it("keeps the header and footer out of the scroll", async () => {
    // The whole point: on a 390px screen the idea editor's Save button used to
    // start below the fold, with the title scrolled away above it (#114).
    await open("sheet");
    expect(document.querySelector('[data-slot="dialog-header"]')).toHaveClass(
      "shrink-0"
    );
    expect(document.querySelector('[data-slot="dialog-footer"]')).toHaveClass(
      "shrink-0"
    );
  });
});

describe("DialogFooter", () => {
  it("carries the home-indicator inset inside a sheet", async () => {
    // The footer *is* the bottom edge there, so its own surface has to fill
    // the safe area rather than leaving a bare strip under it.
    await open("sheet");
    expect(document.querySelector('[data-slot="dialog-footer"]')).toHaveClass(
      "group-data-[variant=sheet]/dialog-content:max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]"
    );
  });

  it("scopes that inset to the sheet variant", async () => {
    // A centred dialog isn't at the bottom edge and must not grow a phantom
    // gap on a notched phone — which is why the rule is written as a
    // `group-data-[variant=sheet]` selector rather than a plain `max-md:`.
    await open("centered");
    const footer = document.querySelector('[data-slot="dialog-footer"]');
    expect(footer?.className).not.toMatch(
      /(?<!variant=sheet\]\/dialog-content:)max-md:pb-\[calc/
    );
  });
});
