import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { navItems } from "@/lib/navigation";

import { Sidebar } from "./sidebar";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname }));

// The palette chip needs a `CommandPaletteProvider` ancestor — out of scope
// for this nav-focused suite, which covers `PaletteTriggerChip` itself in
// `palette-trigger.test.tsx`.
vi.mock("@/components/command-palette/palette-trigger", () => ({
  PaletteTriggerChip: () => null,
}));

describe("Sidebar", () => {
  it("renders every nav item with an accessible name", () => {
    usePathname.mockReturnValue("/");
    render(<Sidebar untriagedCount={0} />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    for (const item of navItems) {
      expect(
        screen.getByRole("link", { name: item.label })
      ).toBeInTheDocument();
    }
    expect(nav).toBeInTheDocument();
  });

  it("puts aria-current on the item matching the current route", () => {
    usePathname.mockReturnValue("/journal");
    render(<Sidebar untriagedCount={0} />);

    expect(screen.getByRole("link", { name: "Journal" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("shows the inbox link with a count badge only when there are untriaged entries", () => {
    usePathname.mockReturnValue("/");
    const { rerender } = render(<Sidebar untriagedCount={0} />);
    // The link is always present…
    expect(screen.getByRole("link", { name: /Inbox/ })).toBeInTheDocument();
    // …but the count badge only appears when there's something to triage.
    expect(document.querySelector('[data-slot="inbox-count"]')).toBeNull();

    rerender(<Sidebar untriagedCount={4} />);
    const badge = document.querySelector('[data-slot="inbox-count"]');
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent("4");
  });
});
