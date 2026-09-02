import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { bottomNavItems, moreNavItems } from "@/lib/navigation";

import { BottomNav } from "./bottom-nav";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname }));

// The sheet's Search row needs a `CommandPaletteProvider` ancestor — out of
// scope for this bar-focused suite, which covers the sheet's own behavior in
// `more-sheet.test.tsx`.
vi.mock("@/components/command-palette/command-palette-provider", () => ({
  useCommandPalette: () => ({ open: false, setOpen: vi.fn() }),
}));

vi.mock("@/lib/auth/actions", () => ({ logout: vi.fn() }));

/** The bar's direct children — four nav links plus the More trigger. */
function slots() {
  return Array.from(
    screen.getByRole("navigation", { name: "Primary" }).children
  );
}

describe("BottomNav", () => {
  it("renders exactly five slots — four destinations plus More (#114)", () => {
    // The bar carried nine items before this, at ~42px each, and every label
    // wrapped across up to three lines.
    usePathname.mockReturnValue("/");
    render(<BottomNav untriagedCount={0} />);

    expect(
      screen.getByRole("navigation", { name: "Primary" })
    ).toBeInTheDocument();
    expect(slots()).toHaveLength(5);
  });

  it("gives every bar destination an accessible name", () => {
    usePathname.mockReturnValue("/");
    render(<BottomNav untriagedCount={0} />);

    for (const item of bottomNavItems) {
      expect(
        screen.getByRole("link", { name: item.label })
      ).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("puts aria-current on the item matching the current route", () => {
    usePathname.mockReturnValue("/calendar");
    render(<BottomNav untriagedCount={0} />);

    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Content" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("keeps the moved destinations out of the bar itself", () => {
    // They're one tap away inside the sheet, not a sixth through ninth slot.
    usePathname.mockReturnValue("/");
    render(<BottomNav untriagedCount={0} />);

    for (const item of moreNavItems) {
      expect(
        screen.queryByRole("link", { name: item.label })
      ).not.toBeInTheDocument();
    }
  });

  it("mirrors the untriaged signal on the More trigger", () => {
    // docs/inbox.md promises the count stays visible on mobile at all times,
    // and the Inbox tab that used to carry it now lives inside the sheet.
    usePathname.mockReturnValue("/");
    render(<BottomNav untriagedCount={4} />);

    expect(
      document.querySelector('[data-slot="more-unread-dot"]')
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "More, 4 to triage" })
    ).toBeInTheDocument();
  });

  it("stays quiet at inbox zero", () => {
    usePathname.mockReturnValue("/");
    render(<BottomNav untriagedCount={0} />);

    expect(document.querySelector('[data-slot="more-unread-dot"]')).toBeNull();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("highlights More while the route lives behind it", () => {
    // The active destination has no slot of its own, so the trigger has to
    // stand in for it — otherwise the bar looks like nothing is selected.
    usePathname.mockReturnValue("/projects/meetings/7");
    render(<BottomNav untriagedCount={0} />);

    expect(screen.getByRole("button", { name: "More" })).toHaveClass(
      "text-foreground"
    );
  });
});
