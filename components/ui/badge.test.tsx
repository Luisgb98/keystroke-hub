import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge, badgeVariants } from "./badge";

describe("Badge", () => {
  it("renders its content", () => {
    render(<Badge>3</Badge>);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("defaults to the accent-filled variant", () => {
    render(<Badge>3</Badge>);
    expect(screen.getByText("3")).toHaveClass("bg-primary");
  });
});

describe("badge variants", () => {
  it("uses the same deepen-toward-foreground hover as Button", () => {
    // Kept in step with components/ui/button.tsx so an accent badge and an
    // accent button never hover differently (see docs/design-system.md).
    const classes = badgeVariants({ variant: "default" });
    expect(classes).toContain(
      "[a]:hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_14%)]"
    );
    expect(classes).not.toContain("hover:bg-primary/");
  });

  it("keeps destructive a tint, matching the button treatment", () => {
    const classes = badgeVariants({ variant: "destructive" });
    expect(classes).toContain("bg-destructive/10");
    expect(classes).toContain("text-destructive");
    expect(classes).not.toMatch(/(^|\s)bg-destructive(\s|$)/);
  });

  it("routes the focus ring through --ring", () => {
    expect(badgeVariants({ variant: "default" })).toContain(
      "focus-visible:ring-ring/50"
    );
  });
});
