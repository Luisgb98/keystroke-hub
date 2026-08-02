import Link from "next/link";
import { Gamepad2 } from "lucide-react";

import type { GameOption } from "@/lib/data/games";
import { cn } from "@/lib/utils";

interface GameChipProps {
  game: GameOption;
  /**
   * Renders the chip as a link into the ideas list filtered by this game —
   * "everything I've made about it" is one tap from wherever the game is
   * shown. Off on surfaces that are already a link (the stream card is a
   * whole-card link, and nesting anchors is invalid HTML).
   */
  href?: boolean;
  className?: string;
}

/** The one way a tagged game reads across the app — idea cards, stream cards, and both detail pages (#105). */
export function GameChip({ game, href = false, className }: GameChipProps) {
  const classes = cn(
    "flex w-fit items-center gap-1.5 text-caption text-muted-foreground",
    href && "hover:underline",
    className
  );
  const content = (
    <>
      <Gamepad2 aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{game.name}</span>
    </>
  );

  if (!href) {
    return (
      <span data-slot="game-chip" className={classes}>
        {content}
      </span>
    );
  }

  return (
    <Link
      data-slot="game-chip"
      href={`/content/ideas?game=${encodeURIComponent(game.id)}`}
      className={classes}
    >
      {content}
    </Link>
  );
}
