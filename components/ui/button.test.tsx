import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button, buttonVariants } from "./button";

const VARIANTS = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const;

describe("Button", () => {
  it("renders a button with its label", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("defaults to the default variant and size", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "bg-primary"
    );
  });

  it("passes className through alongside the variant classes", () => {
    render(<Button className="w-full">Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveClass("w-full");
    expect(button).toHaveClass("bg-primary");
  });
});

/**
 * The button system is a design contract (see docs/design-system.md), so these
 * assert the rules rather than the exact utility strings: every variant gets a
 * hover and a pressed state, and destructive stays structurally unlike default.
 */
describe("button variants", () => {
  it.each(VARIANTS)("%s defines a hover state", (variant) => {
    expect(buttonVariants({ variant })).toMatch(/(^|\s)(dark:)?hover:/);
  });

  it.each(VARIANTS)("%s defines a pressed state", (variant) => {
    // `link` presses via color, the rest via surface; both use `active:`.
    expect(buttonVariants({ variant })).toMatch(/(^|\s)(dark:)?active:/);
  });

  it.each(VARIANTS)("%s defines a visible focus treatment", (variant) => {
    expect(buttonVariants({ variant })).toMatch(/focus-visible:/);
  });

  it("routes the default focus ring through --ring", () => {
    // The accent-derived ring token — not a per-variant one-off.
    expect(buttonVariants({ variant: "default" })).toContain(
      "focus-visible:ring-ring/50"
    );
  });

  it("fills default with the accent and its paired foreground", () => {
    const classes = buttonVariants({ variant: "default" });
    expect(classes).toContain("bg-primary");
    expect(classes).toContain("text-primary-foreground");
  });

  it("keeps destructive a tint with colored text, never a solid fill", () => {
    // The core safeguard from issue #84: primary and destructive are both reds
    // now, so "delete" must differ from the default action structurally.
    const classes = buttonVariants({ variant: "destructive" });
    expect(classes).toContain("bg-destructive/10");
    expect(classes).toContain("text-destructive");
    expect(classes).not.toMatch(/(^|\s)bg-destructive(\s|$)/);
    expect(classes).not.toContain("text-destructive-foreground");
  });

  it("gives destructive its own focus ring rather than the accent's", () => {
    const classes = buttonVariants({ variant: "destructive" });
    expect(classes).toContain("focus-visible:ring-destructive/20");
  });

  it("deepens filled variants toward --foreground instead of fading them out", () => {
    // An alpha step lightens a solid accent against the page and reads as
    // disabled; mixing toward --foreground darkens in light mode and lightens
    // in dark mode. Guards against a regression to `hover:bg-primary/80`.
    const classes = buttonVariants({ variant: "default" });
    expect(classes).toContain(
      "hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_14%)]"
    );
    expect(classes).not.toContain("hover:bg-primary/");
  });

  it("never hardcodes a raw color outside the token system", () => {
    for (const variant of VARIANTS) {
      expect(buttonVariants({ variant }), variant).not.toMatch(
        /#[0-9a-f]{3,8}\b|\brgb\(|\boklch\(\s*[\d.]/i
      );
    }
  });
});

/**
 * Touch targets (#114). The audit that opened the issue found almost nothing
 * in the app clearing Apple's 44px minimum on a phone — most controls sat at
 * 32px or less — so every size is a touch target below `md` and collapses back
 * to the desktop scale from `md` up.
 */
describe("button sizes on a phone", () => {
  const TOUCH_SIZES = ["default", "sm", "lg"] as const;
  const TOUCH_ICON_SIZES = ["icon", "icon-sm", "icon-lg"] as const;

  it.each(TOUCH_SIZES)("gives size=%s a 44px height below md", (size) => {
    expect(buttonVariants({ size })).toContain("h-11");
  });

  it.each(TOUCH_ICON_SIZES)("gives size=%s a 44px square below md", (size) => {
    expect(buttonVariants({ size })).toContain("size-11");
  });

  it.each([...TOUCH_SIZES, ...TOUCH_ICON_SIZES])(
    "restores the desktop scale for size=%s from md up",
    (size) => {
      // The dense desktop design is unchanged — the phone sizing must not leak
      // into it, or every toolbar in the app grows by 12px.
      expect(buttonVariants({ size })).toMatch(/md:(h|size)-\d/);
    }
  );

  it("keeps the xs pair deliberately smaller", () => {
    // `xs` is the inline-chip size, used *inside* rows of text — a 44px
    // control there would out-shout the content it belongs to. It still grows
    // from 24px to 36px on a phone.
    expect(buttonVariants({ size: "xs" })).toContain("h-9");
    expect(buttonVariants({ size: "xs" })).toContain("md:h-6");
    expect(buttonVariants({ size: "icon-xs" })).toContain("size-9");
    expect(buttonVariants({ size: "icon-xs" })).toContain("md:size-6");
  });
});
