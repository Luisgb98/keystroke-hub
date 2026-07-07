import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/actions", () => ({ logout: vi.fn() }));

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
});
