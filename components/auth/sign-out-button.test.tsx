import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/actions", () => ({ logout: vi.fn() }));

import { MORE_SHEET_ROW_CLASSES } from "@/components/shell/bottom-nav-styles";

import { SignOutButton } from "./sign-out-button";

describe("SignOutButton", () => {
  it("sidebar variant renders an icon button named Sign out", () => {
    render(<SignOutButton variant="sidebar" />);
    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button.closest("form")).not.toBeNull();
  });

  it("sheet variant renders a labelled row in the More sheet", () => {
    render(<SignOutButton variant="sheet" />);
    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toHaveAttribute("type", "submit");
    expect(screen.getByText("Sign out")).toBeVisible();
  });

  it("uses the shared More-sheet row geometry rather than a hand-copied class string", () => {
    // It sits in the same list as the sheet's nav links and Search action, and
    // can't read the constant off a `"use client"` module — so the shared
    // string is the only thing keeping the row from drifting (#85, #114).
    render(<SignOutButton variant="sheet" />);
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute(
      "class",
      MORE_SHEET_ROW_CLASSES
    );
  });
});
