import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TokenSwatch } from "./token-swatch";

describe("TokenSwatch", () => {
  it("shows the token's display name and CSS variable", () => {
    render(<TokenSwatch name="Primary" cssVar="primary" />);
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText(/--primary/)).toBeInTheDocument();
  });

  it("renders the description when one is given", () => {
    // The palette's design decisions live in these descriptions (#84) — they
    // were defined in lib/tokens.ts but never shown on the styleguide.
    render(
      <TokenSwatch
        name="Primary"
        cssVar="primary"
        description="Brand accent (#a8454b) — primary actions"
      />
    );
    expect(
      screen.getByText("Brand accent (#a8454b) — primary actions")
    ).toBeInTheDocument();
  });

  it("omits the description line when none is given", () => {
    const { container } = render(<TokenSwatch name="Card" cssVar="card" />);
    // Name + var line only.
    expect(container.querySelectorAll("span")).toHaveLength(2);
  });

  it("paints the swatch from the token, never a hardcoded color", () => {
    const { container } = render(<TokenSwatch name="Ring" cssVar="ring" />);
    expect(container.querySelector("[style]")).toHaveStyle({
      background: "var(--ring)",
    });
  });
});
