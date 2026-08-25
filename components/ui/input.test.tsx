import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "./input";

describe("Input", () => {
  it("renders a 44px field on a phone and the dense one from md up", () => {
    // #114's audit found the app's fields at 32px on a 390px screen — below
    // any usable touch target. Desktop density is unchanged.
    render(<Input aria-label="Title" />);
    const input = screen.getByLabelText("Title");
    expect(input).toHaveClass("h-11");
    expect(input).toHaveClass("md:h-8");
  });

  it("renders at 16px on a phone, so iOS never zooms on focus", () => {
    // Safari zooms the whole page when a focused field computes below 16px —
    // most of what makes typing in a web app on an iPhone feel janky.
    render(<Input aria-label="Title" />);
    const input = screen.getByLabelText("Title");
    expect(input).toHaveClass("text-base");
    expect(input).toHaveClass("md:text-sm");
  });
});
