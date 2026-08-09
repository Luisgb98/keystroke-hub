import Link from "next/link";
import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import type { DeltaDirection } from "@/lib/dashboard/month-review";

const DIRECTION_ICON: Record<DeltaDirection, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

interface StatTileProps {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Where the number's full feature lives — every tile is a door. */
  href: string;
  /** Rendered from `formatDeltaLabel`; omitted while the comparison is unavailable. */
  delta?: string;
  direction?: DeltaDirection;
}

/**
 * One headline number of the month, with its change against the previous
 * month (issue #110).
 *
 * The delta is an arrow icon plus a signed number in muted ink — never a
 * green/red verdict. Two reasons: fewer videos in a month you streamed more
 * isn't a failure, and this app's voice is observation, not judgement (see
 * `WeeklySignals`). It also keeps direction off colour alone, so the arrow
 * survives greyscale and colour blindness.
 *
 * The value uses the body sans with proportional figures — `tabular-nums`
 * is for columns that must align, and at this size it makes a small number
 * look loose.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  href,
  delta,
  direction = "flat",
}: StatTileProps) {
  const DirectionIcon = DIRECTION_ICON[direction];

  return (
    <Link
      href={href}
      data-slot="stat-tile"
      className="flex flex-col gap-1 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted"
    >
      <span className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        {label}
      </span>
      <span className="text-h2 font-semibold">{value}</span>
      {delta ? (
        <span className="flex items-center gap-1 text-caption text-muted-foreground">
          <DirectionIcon aria-hidden className="size-3 shrink-0" />
          {delta}
        </span>
      ) : null}
    </Link>
  );
}
