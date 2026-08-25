import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { moreNavItems } from "@/lib/navigation";

import { MoreSheet } from "./more-sheet";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname }));

const setPaletteOpen = vi.hoisted(() => vi.fn());
vi.mock("@/components/command-palette/command-palette-provider", () => ({
  useCommandPalette: () => ({ open: false, setOpen: setPaletteOpen }),
}));

/** Stands in for the sign-out server component the bottom nav slots in. */
function SignOutSlot() {
  return <button type="submit">Sign out</button>;
}

function renderSheet(untriagedCount = 0) {
  return render(
    <MoreSheet untriagedCount={untriagedCount}>
      <SignOutSlot />
    </MoreSheet>
  );
}

async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /More/ }));
  return screen.findByRole("navigation", { name: "More" });
}

describe("MoreSheet", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps its contents out of the DOM until it's opened", () => {
    usePathname.mockReturnValue("/");
    renderSheet();

    expect(
      screen.queryByRole("link", { name: "Projects & Meetings" })
    ).not.toBeInTheDocument();
  });

  it("reaches every destination that lost its bar slot, in one tap", async () => {
    // The acceptance criterion behind the whole split (#114): nothing may
    // become unreachable when the bar goes from nine items to five.
    usePathname.mockReturnValue("/");
    const user = userEvent.setup();
    renderSheet();
    await openSheet(user);

    for (const item of moreNavItems) {
      expect(
        await screen.findByRole("link", { name: new RegExp(item.label) })
      ).toHaveAttribute("href", item.href);
    }
  });

  it("carries the two actions the bar gave up — Search and Sign out", async () => {
    usePathname.mockReturnValue("/");
    const user = userEvent.setup();
    renderSheet();
    await openSheet(user);

    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" })
    ).toBeInTheDocument();
  });

  it("closes itself before handing over to the command palette", async () => {
    // Two stacked modals would fight over the focus trap, and the palette is
    // the one that should win.
    usePathname.mockReturnValue("/");
    const user = userEvent.setup();
    renderSheet();
    await openSheet(user);

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(setPaletteOpen).toHaveBeenCalledWith(true);
    expect(
      screen.queryByRole("navigation", { name: "More" })
    ).not.toBeInTheDocument();
  });

  it("shows the untriaged count on the Inbox row and announces it after the label", async () => {
    usePathname.mockReturnValue("/");
    const user = userEvent.setup();
    renderSheet(3);
    await openSheet(user);

    expect(
      document.querySelector('[data-slot="inbox-count"]')
    ).toHaveTextContent("3");
    expect(
      screen.getByRole("link", { name: "Inbox, 3 to triage" })
    ).toBeInTheDocument();
  });

  it("marks the row matching the current route", async () => {
    usePathname.mockReturnValue("/inbox");
    const user = userEvent.setup();
    renderSheet();
    await openSheet(user);

    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("link", { name: "Projects & Meetings" })
    ).not.toHaveAttribute("aria-current");
  });

  it("dots the trigger while something is waiting in the inbox", () => {
    usePathname.mockReturnValue("/");
    renderSheet(2);

    expect(
      document.querySelector('[data-slot="more-unread-dot"]')
    ).not.toBeNull();
  });

  it("closes when a destination is tapped", async () => {
    // The sheet is a navigation menu, not a page: leaving it open over the
    // destination would cover the page the tap just asked for.
    usePathname.mockReturnValue("/");
    const user = userEvent.setup();
    renderSheet();
    await openSheet(user);

    await user.click(screen.getByRole("link", { name: "Projects & Meetings" }));

    expect(
      screen.queryByRole("navigation", { name: "More" })
    ).not.toBeInTheDocument();
  });
});
