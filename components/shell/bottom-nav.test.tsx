import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { navItems } from "@/lib/navigation";

import { BottomNav } from "./bottom-nav";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname }));

describe("BottomNav", () => {
  it("renders every nav item with an accessible name", () => {
    usePathname.mockReturnValue("/");
    render(<BottomNav />);

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
    render(<BottomNav />);

    expect(
      screen.getByRole("link", { name: "Projects & Meetings" })
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Content" })).not.toHaveAttribute(
      "aria-current"
    );
  });
});
