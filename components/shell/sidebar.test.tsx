import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { navItems } from "@/lib/navigation";

import { Sidebar } from "./sidebar";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname }));

describe("Sidebar", () => {
  it("renders every nav item with an accessible name", () => {
    usePathname.mockReturnValue("/");
    render(<Sidebar />);

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
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: "Journal" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current"
    );
  });
});
