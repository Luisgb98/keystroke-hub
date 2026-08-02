import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { navItems } from "@/lib/navigation";

import { BottomNav } from "./bottom-nav";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname }));

// The search button needs a `CommandPaletteProvider` ancestor — out of scope
// for this nav-focused suite, which covers `PaletteSearchButton` itself in
// `palette-trigger.test.tsx`.
vi.mock("@/components/command-palette/palette-trigger", () => ({
  PaletteSearchButton: () => null,
}));

describe("BottomNav", () => {
  it("renders every nav item with an accessible name", () => {
    usePathname.mockReturnValue("/");
    render(<BottomNav untriagedCount={0} />);

    expect(
      screen.getByRole("navigation", { name: "Primary" })
    ).toBeInTheDocument();
    for (const item of navItems) {
      expect(
        screen.getByRole("link", { name: item.label })
      ).toBeInTheDocument();
    }
  });

  it("puts aria-current on the item matching the current route", () => {
    usePathname.mockReturnValue("/projects");
    render(<BottomNav untriagedCount={0} />);

    expect(
      screen.getByRole("link", { name: "Projects & Meetings" })
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Content" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("carries an Inbox tab — mobile's only persistent inbox entry point (#85)", () => {
    usePathname.mockReturnValue("/");
    render(<BottomNav untriagedCount={0} />);

    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveAttribute(
      "href",
      "/inbox"
    );
  });

  it("marks the Inbox tab active on /inbox", () => {
    usePathname.mockReturnValue("/inbox");
    render(<BottomNav untriagedCount={0} />);

    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("shows the untriaged count on the Inbox tab and announces it after the label", () => {
    usePathname.mockReturnValue("/");
    render(<BottomNav untriagedCount={4} />);

    const badge = document.querySelector('[data-slot="inbox-count"]');
    expect(badge).toHaveTextContent("4");
    expect(
      screen.getByRole("link", { name: "Inbox, 4 to triage" })
    ).toBeInTheDocument();
  });

  it("stays quiet at inbox zero", () => {
    usePathname.mockReturnValue("/");
    render(<BottomNav untriagedCount={0} />);

    expect(document.querySelector('[data-slot="inbox-count"]')).toBeNull();
  });
});
