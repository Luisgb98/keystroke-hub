import { render, screen } from "@testing-library/react";
import { Clapperboard } from "lucide-react";
import { describe, expect, it } from "vitest";

import { StatTile } from "./stat-tile";

describe("StatTile", () => {
  it("renders the label, the number, and a door into the full feature", () => {
    render(
      <StatTile
        label="Videos published"
        value={4}
        icon={Clapperboard}
        href="/content/ideas?status=published"
      />
    );

    const link = screen.getByRole("link", { name: /Videos published/ });
    expect(link).toHaveAttribute("href", "/content/ideas?status=published");
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders a zero month as a zero, not as a missing tile", () => {
    render(
      <StatTile label="Streams" value={0} icon={Clapperboard} href="/x" />
    );
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows the delta line when there is a comparison", () => {
    render(
      <StatTile
        label="Streams"
        value={3}
        icon={Clapperboard}
        href="/x"
        delta="+2 vs Jul"
        direction="up"
      />
    );
    expect(screen.getByText("+2 vs Jul")).toBeInTheDocument();
  });

  it("omits the delta line entirely when there is nothing to compare against", () => {
    render(
      <StatTile label="Streams" value={3} icon={Clapperboard} href="/x" />
    );
    expect(screen.queryByText(/vs /)).toBeNull();
    expect(screen.queryByText(/Same as/)).toBeNull();
  });
});
