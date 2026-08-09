import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RankingBars } from "./ranking-bars";

describe("RankingBars", () => {
  it("renders the label and count of every row as real text, not just a bar", () => {
    render(
      <RankingBars
        unit="ideas"
        rows={[
          { key: "a", label: "Path of Exile", count: 5, share: 1 },
          { key: "b", label: "Hades", count: 2, share: 0.4 },
        ]}
      />
    );

    expect(screen.getByText("Path of Exile")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Hades")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("sizes each bar by its share, so magnitude is length and never colour", () => {
    const { container } = render(
      <RankingBars
        unit="ideas"
        rows={[
          { key: "a", label: "Top", count: 4, share: 1 },
          { key: "b", label: "Half", count: 2, share: 0.5 },
        ]}
      />
    );

    const fills = container.querySelectorAll<HTMLElement>(".bg-primary");
    expect(fills).toHaveLength(2);
    expect(fills[0].style.width).toBe("100%");
    expect(fills[1].style.width).toBe("50%");
  });

  it("gives a zero row an empty bar rather than dropping the row", () => {
    const { container } = render(
      <RankingBars
        unit="ideas"
        rows={[{ key: "a", label: "Recorded", count: 0, share: 0 }]}
      />
    );

    expect(screen.getByText("Recorded")).toBeInTheDocument();
    expect(
      container.querySelector<HTMLElement>(".bg-primary")?.style.width
    ).toBe("0%");
  });

  it("links a row that has somewhere to go, and only that row", () => {
    render(
      <RankingBars
        unit="items"
        rows={[
          {
            key: "a",
            label: "Hades",
            count: 3,
            share: 1,
            href: "/content/ideas?game=g1",
          },
          { key: "b", label: "No game", count: 1, share: 0.33, href: null },
        ]}
      />
    );

    expect(screen.getByRole("link", { name: /Hades/ })).toHaveAttribute(
      "href",
      "/content/ideas?game=g1"
    );
    expect(screen.queryByRole("link", { name: /No game/ })).toBeNull();
    expect(screen.getByText("No game")).toBeInTheDocument();
  });

  it("names the unit for screen readers, since a bare number says nothing", () => {
    render(
      <RankingBars
        unit="videos"
        rows={[{ key: "a", label: "Hades", count: 3, share: 1 }]}
      />
    );

    expect(screen.getByText("videos")).toBeInTheDocument();
  });

  it("renders the optional detail line under a row", () => {
    render(
      <RankingBars
        unit="items"
        rows={[
          {
            key: "a",
            label: "Hades",
            count: 4,
            share: 1,
            detail: "3 ideas · 1 stream",
          },
        ]}
      />
    );

    expect(screen.getByText("3 ideas · 1 stream")).toBeInTheDocument();
  });

  it("renders nothing at all for an empty list", () => {
    const { container } = render(<RankingBars unit="items" rows={[]} />);
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });
});
