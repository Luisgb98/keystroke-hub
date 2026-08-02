import { render, screen } from "@testing-library/react";
import { LayoutDashboard } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import {
  BOTTOM_NAV_ICON_CLASSES,
  BOTTOM_NAV_ITEM_CLASSES,
  BOTTOM_NAV_LABEL_CLASSES,
} from "./bottom-nav-styles";
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

  it("builds the bottom variant from the shared bottom-nav item classes", () => {
    // Exported so the palette search button and sign-out form share one
    // geometry rather than keeping drifting copies (#84).
    usePathname.mockReturnValue("/content");
    render(
      <NavLink href="/calendar" label="Calendar" icon={icon} variant="bottom" />
    );
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "class",
      BOTTOM_NAV_ITEM_CLASSES
    );
  });

  it("builds the bottom variant's icon pill and label from the shared classes too", () => {
    // The nine-slot row (#85) resized both; the other occupants of the row read
    // the same constants, so nothing can drift out of the new geometry.
    usePathname.mockReturnValue("/content");
    const { container } = render(
      <NavLink href="/calendar" label="Calendar" icon={icon} variant="bottom" />
    );
    expect(container.querySelector("svg")?.parentElement).toHaveAttribute(
      "class",
      BOTTOM_NAV_ICON_CLASSES
    );
    expect(screen.getByText("Calendar")).toHaveAttribute(
      "class",
      BOTTOM_NAV_LABEL_CLASSES
    );
  });

  it("trails the badge after the label on the sidebar variant", () => {
    usePathname.mockReturnValue("/");
    render(
      <NavLink
        href="/inbox"
        label="Inbox"
        icon={icon}
        variant="sidebar"
        badge={
          <span aria-hidden data-testid="badge">
            3
          </span>
        }
        badgeLabel="3 to triage"
      />
    );
    const link = screen.getByRole("link", { name: "Inbox, 3 to triage" });
    expect(link.lastElementChild).toHaveAttribute("data-testid", "badge");
  });

  it("sits the badge on the icon for the bottom variant, where a trailing chip has no room (#85)", () => {
    usePathname.mockReturnValue("/");
    render(
      <NavLink
        href="/inbox"
        label="Inbox"
        icon={icon}
        variant="bottom"
        badge={
          <span aria-hidden data-testid="badge">
            3
          </span>
        }
        badgeLabel="3 to triage"
      />
    );
    // The icon's own wrapper is `relative`, so an absolutely-positioned badge
    // anchors to the tab icon rather than the whole tab.
    const badge = screen.getByTestId("badge");
    expect(badge.parentElement).toHaveClass("relative");
    expect(badge.parentElement?.querySelector("svg")).not.toBeNull();
    // …while the count is announced after the label, not before it.
    expect(
      screen.getByRole("link", { name: "Inbox, 3 to triage" })
    ).toBeInTheDocument();
  });

  it("marks the active bottom item with an accent dot", () => {
    usePathname.mockReturnValue("/calendar");
    const { container } = render(
      <NavLink href="/calendar" label="Calendar" icon={icon} variant="bottom" />
    );
    expect(container.querySelector(".bg-primary")).not.toBeNull();
  });
});
