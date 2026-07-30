import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/actions", () => ({ logout: vi.fn() }));

import { BOTTOM_NAV_ITEM_CLASSES } from "@/components/shell/bottom-nav-styles";

import { SignOutButton } from "./sign-out-button";

describe("SignOutButton", () => {
  it("sidebar variant renders an icon button named Sign out", () => {
    render(<SignOutButton variant="sidebar" />);
    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button.closest("form")).not.toBeNull();
  });

  it("bottom variant renders a labelled tab-bar action", () => {
    render(<SignOutButton variant="bottom" />);
    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toHaveAttribute("type", "submit");
    expect(screen.getByText("Sign out")).toBeVisible();
  });

  it("uses the shared bottom-nav geometry rather than a hand-copied class string", () => {
    // It sits in the same row as the nav links and the palette search button;
    // the copy it used to keep drifted the moment that row was resized (#85).
    render(<SignOutButton variant="bottom" />);
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute(
      "class",
      BOTTOM_NAV_ITEM_CLASSES
    );
  });
});
