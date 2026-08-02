import type { Metadata } from "next";

import { GameLibrary } from "@/components/content/games/game-library";
import { getGamesWithUsage, type GameWithUsage } from "@/lib/data/games";

export const metadata: Metadata = {
  title: "Games",
};

export default async function GamesPage() {
  // Renders even if the database is unreachable — same resilience contract as
  // /content/ideas and /content/streams (see docs/database.md).
  let games: GameWithUsage[] = [];
  try {
    games = await getGamesWithUsage();
  } catch (error) {
    console.error("Failed to load games:", error);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:mx-auto sm:w-full sm:max-w-2xl sm:px-10 sm:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-h1 font-semibold">Games</h1>
        <p className="text-small text-muted-foreground">
          The library your ideas and streams are tagged from. Renaming one
          updates it everywhere.
        </p>
      </div>

      <GameLibrary games={games} />
    </div>
  );
}
