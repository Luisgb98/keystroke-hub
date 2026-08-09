import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TagRankingView } from "./tag-ranking-card";

describe("TagRankingView", () => {
  it("ranks the month's hashtags with their counts", () => {
    render(
      <TagRankingView
        tags={[
          { tag: "speedrun", count: 5 },
          { tag: "vod", count: 2 },
        ]}
      />
    );

    expect(screen.getByText("#speedrun")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("#vod")).toBeInTheDocument();
  });

  it("deep-links a tag into the ideas view filtered by it", () => {
    render(<TagRankingView tags={[{ tag: "speedrun", count: 1 }]} />);

    expect(screen.getByRole("link", { name: /#speedrun/ })).toHaveAttribute(
      "href",
      "/content/ideas?tag=speedrun"
    );
  });

  it("encodes a tag that isn't URL-safe", () => {
    render(<TagRankingView tags={[{ tag: "path of exile", count: 1 }]} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/content/ideas?tag=path%20of%20exile"
    );
  });

  it("caps the list at the card's limit", () => {
    render(
      <TagRankingView
        tags={Array.from({ length: 8 }, (_, index) => ({
          tag: `tag${index}`,
          count: 8 - index,
        }))}
      />
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });

  it("says so plainly for a month with no tags", () => {
    render(<TagRankingView tags={[]} />);
    expect(
      screen.getByText("No hashtags on this month’s ideas yet.")
    ).toBeInTheDocument();
  });

  it("degrades to a message when the query failed", () => {
    render(<TagRankingView tags={null} />);
    expect(
      screen.getByText("Couldn’t load the hashtag breakdown.")
    ).toBeInTheDocument();
  });
});
