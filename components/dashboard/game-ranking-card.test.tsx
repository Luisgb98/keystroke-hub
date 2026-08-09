import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { GameAttention } from "@/lib/dashboard/month-review";

import { GameRankingView } from "./game-ranking-card";

function game(overrides: Partial<GameAttention>): GameAttention {
  return {
    gameId: "g1",
    name: "Hades",
    ideaCount: 0,
    streamCount: 0,
    total: 0,
    ...overrides,
  };
}

describe("GameRankingView", () => {
  it("ranks the month's games and says where each total came from", () => {
    render(
      <GameRankingView
        games={[
          game({
            gameId: "g1",
            name: "Path of Exile",
            ideaCount: 4,
            streamCount: 2,
            total: 6,
          }),
          game({
            gameId: "g2",
            name: "Hades",
            ideaCount: 1,
            streamCount: 0,
            total: 1,
          }),
        ]}
      />
    );

    expect(screen.getByText("Path of Exile")).toBeInTheDocument();
    expect(screen.getByText("4 ideas · 2 streams")).toBeInTheDocument();
    expect(screen.getByText("Hades")).toBeInTheDocument();
    expect(screen.getByText("1 idea")).toBeInTheDocument();
  });

  it("deep-links a game row into the ideas view filtered by that game's id", () => {
    render(
      <GameRankingView
        games={[
          game({ gameId: "game-123", name: "Balatro", ideaCount: 2, total: 2 }),
        ]}
      />
    );

    expect(screen.getByRole("link", { name: /Balatro/ })).toHaveAttribute(
      "href",
      "/content/ideas?game=game-123"
    );
  });

  it("counts untagged work as 'No game' but leaves it unlinked — there is no such filtered view", () => {
    render(
      <GameRankingView
        games={[
          game({ gameId: null, name: "No game", ideaCount: 3, total: 3 }),
        ]}
      />
    );

    expect(screen.getByText("No game")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("caps the list rather than turning the card into a list page", () => {
    render(
      <GameRankingView
        games={Array.from({ length: 9 }, (_, index) =>
          game({
            gameId: `g${index}`,
            name: `Game ${index}`,
            ideaCount: 9 - index,
            total: 9 - index,
          })
        )}
      />
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });

  it("invites a fix for a month with nothing tagged", () => {
    render(<GameRankingView games={[]} />);
    expect(
      screen.getByText(/Nothing tagged with a game this month/)
    ).toBeInTheDocument();
  });

  it("degrades to a message when the query failed", () => {
    render(<GameRankingView games={null} />);
    expect(
      screen.getByText("Couldn’t load the game breakdown.")
    ).toBeInTheDocument();
  });
});
