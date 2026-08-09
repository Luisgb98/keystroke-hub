import Link from "next/link";
import { Gamepad2 } from "lucide-react";

import { getGameAttention } from "@/lib/data/dashboard";
import {
  formatGameAttentionDetail,
  monthRange,
  rankItems,
  type GameAttention,
} from "@/lib/dashboard/month-review";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { MonthCardSkeleton } from "./month-card-skeleton";
import { RankingBars } from "./ranking-bars";

/** Enough to see the shape of a month without turning the card into a list page. */
const GAME_LIMIT = 6;

interface GameRankingViewProps {
  /** `null` means the query failed — an empty array is a real, empty month. */
  games: GameAttention[] | null;
}

/**
 * Which game ate the month, across both streams and video ideas. Pure, so
 * its three states — data, empty month, failed query — are unit-testable.
 *
 * The "no game" bucket is ranked alongside real games rather than dropped
 * (an untagged month is a fact worth seeing), but it carries no link: there
 * is no "ideas without a game" view to open.
 */
export function GameRankingView({ games }: GameRankingViewProps) {
  if (!games) {
    return (
      <p className="text-small text-muted-foreground">
        Couldn&rsquo;t load the game breakdown.
      </p>
    );
  }

  if (games.length === 0) {
    return (
      <p className="text-small text-muted-foreground">
        Nothing tagged with a game this month. Tag an idea or a stream and the
        ranking fills in.
      </p>
    );
  }

  return (
    <RankingBars
      unit="items"
      rows={rankItems(
        games.map((game) => ({
          key: game.gameId ?? "no-game",
          label: game.name,
          count: game.total,
          href: game.gameId ? `/content/ideas?game=${game.gameId}` : null,
          detail: formatGameAttentionDetail(game),
        })),
        GAME_LIMIT
      )}
    />
  );
}

/** Self-fetching game-ranking block — same per-block DB-failure contract as the Today blocks (docs/database.md). */
export async function GameRankingCard({ month }: { month: string }) {
  let games: GameAttention[] | null = null;
  try {
    games = await getGameAttention(monthRange(month));
  } catch (error) {
    console.error("Failed to load the month's game breakdown:", error);
  }

  return (
    <Card className="border-track-content-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Gamepad2 aria-hidden className="size-4 shrink-0" />
          Games
        </CardTitle>
      </CardHeader>
      <CardContent>
        <GameRankingView games={games} />
      </CardContent>
      {/* `mt-auto`: the three cards share a stretch grid, so the footer
          has to sit on the card's bottom edge rather than under its content. */}
      <CardFooter className="mt-auto">
        <Link
          href="/content/games"
          className="text-small font-medium text-primary hover:underline"
        >
          Game library →
        </Link>
      </CardFooter>
    </Card>
  );
}

export function GameRankingSkeleton() {
  return <MonthCardSkeleton title="Games" />;
}
