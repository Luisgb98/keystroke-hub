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
    // Exported so the "More" sheet's trigger shares one geometry with the nav
    // links rather than keeping a drifting copy (#84, #114).
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
    // The five-slot row (#114) resized both; the "More" trigger reads the same
    // constants, so nothing can drift out of the new geometry.
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

  it("keeps the bottom variant badge-free — the count rides the More trigger now (#114)", () => {
    // The bar lost its Inbox tab when it was cut to four destinations plus
    // "More", so nothing in the row carries a count any more; `MoreSheet`'s
    // trigger shows the dot instead. The prop type forbids passing one here,
    // and this pins the rendered result to match.
    usePathname.mockReturnValue("/");
    const { container } = render(
      <NavLink href="/calendar" label="Calendar" icon={icon} variant="bottom" />
    );
    expect(container.querySelector('[data-slot="inbox-count"]')).toBeNull();
  });

  it("marks the active bottom item with an accent dot", () => {
    usePathname.mockReturnValue("/calendar");
    const { container } = render(
      <NavLink href="/calendar" label="Calendar" icon={icon} variant="bottom" />
    );
    expect(container.querySelector(".bg-primary")).not.toBeNull();
  });
});
