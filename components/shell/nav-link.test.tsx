import { render, screen } from "@testing-library/react";
import { LayoutDashboard } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { NavLink } from "./nav-link";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname }));

const icon = <LayoutDashboard aria-hidden className="size-5" />;

describe("NavLink", () => {
  it("marks the item active on an exact pathname match", () => {
    usePathname.mockReturnValue("/calendar");
    render(
      <NavLink
        href="/calendar"
        label="Calendar"
        icon={icon}
        variant="sidebar"
      />
    );
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("marks the item active on a nested pathname match", () => {
    usePathname.mockReturnValue("/calendar/2026-07-06");
    render(
      <NavLink href="/calendar" label="Calendar" icon={icon} variant="bottom" />
    );
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("does not mark the item active on an unrelated pathname", () => {
    usePathname.mockReturnValue("/content");
    render(
      <NavLink
        href="/calendar"
        label="Calendar"
        icon={icon}
        variant="sidebar"
      />
    );
    expect(screen.getByRole("link", { name: "Calendar" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("never marks a non-root item active for the root route", () => {
    usePathname.mockReturnValue("/");
    render(
      <NavLink
        href="/calendar"
        label="Calendar"
        icon={icon}
        variant="sidebar"
      />
    );
    expect(screen.getByRole("link", { name: "Calendar" })).not.toHaveAttribute(
      "aria-current"
    );
  });
});
