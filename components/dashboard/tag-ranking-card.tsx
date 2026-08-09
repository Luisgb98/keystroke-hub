import Link from "next/link";
import { Hash } from "lucide-react";

import { getTagUsage, type TagUsage } from "@/lib/data/dashboard";
import { monthRange, rankItems } from "@/lib/dashboard/month-review";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { MonthCardSkeleton } from "./month-card-skeleton";
import { RankingBars } from "./ranking-bars";

/** Matches the game card's cap — the two sit side by side and must read as one system. */
const TAG_LIMIT = 6;

interface TagRankingViewProps {
  /** `null` means the query failed — an empty array is a real, empty month. */
  tags: TagUsage[] | null;
}

/**
 * The month's most-used hashtags — what the creator keeps talking about.
 * Pure, so its three states (data, empty month, failed query) are
 * unit-testable.
 */
export function TagRankingView({ tags }: TagRankingViewProps) {
  if (!tags) {
    return (
      <p className="text-small text-muted-foreground">
        Couldn&rsquo;t load the hashtag breakdown.
      </p>
    );
  }

  if (tags.length === 0) {
    return (
      <p className="text-small text-muted-foreground">
        No hashtags on this month&rsquo;s ideas yet.
      </p>
    );
  }

  return (
    <RankingBars
      unit="ideas"
      rows={rankItems(
        tags.map((tag) => ({
          key: tag.tag,
          label: `#${tag.tag}`,
          count: tag.count,
          href: `/content/ideas?tag=${encodeURIComponent(tag.tag)}`,
        })),
        TAG_LIMIT
      )}
    />
  );
}

/** Self-fetching hashtag block — same per-block DB-failure contract as the Today blocks (docs/database.md). */
export async function TagRankingCard({ month }: { month: string }) {
  let tags: TagUsage[] | null = null;
  try {
    tags = await getTagUsage(monthRange(month), TAG_LIMIT);
  } catch (error) {
    console.error("Failed to load the month's hashtags:", error);
  }

  return (
    <Card className="border-track-content-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Hash aria-hidden className="size-4 shrink-0" />
          Hashtags
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TagRankingView tags={tags} />
      </CardContent>
      {/* `mt-auto`: the three cards share a stretch grid, so the footer
          has to sit on the card's bottom edge rather than under its content. */}
      <CardFooter className="mt-auto">
        <Link
          href="/content/ideas"
          className="text-small font-medium text-primary hover:underline"
        >
          All ideas →
        </Link>
      </CardFooter>
    </Card>
  );
}

export function TagRankingSkeleton() {
  return <MonthCardSkeleton title="Hashtags" />;
}
