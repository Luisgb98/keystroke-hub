import Link from "next/link";

export interface RankingBarRow {
  /** React key — a game id, a tag, a pipeline status. */
  key: string;
  label: string;
  count: number;
  /** `0`–`1`, relative to the largest row (see `withShare` in `lib/dashboard/month-review.ts`). */
  share: number;
  /** Where the row deep-links, or `null` for a row with no filtered view to open (the "no game" bucket, an empty stage). */
  href?: string | null;
  /** Optional second line, e.g. `3 ideas · 1 stream`. */
  detail?: string;
}

interface RankingBarsProps {
  rows: RankingBarRow[];
  /** Read out with each row's count, e.g. `videos` — the number alone doesn't say what it counts. */
  unit: string;
}

/**
 * The one ranked-bar list the month review uses everywhere — games, tags,
 * pipeline stages (issue #110).
 *
 * A ranking's job is magnitude, so it's one hue at varying *length*: every
 * bar is `bg-primary` on a `bg-muted` track, and nothing is encoded in
 * colour. That keeps it inside the design system (no primary tints, see
 * docs/design-system.md), AA-legible in both themes for free, and honest —
 * a reader compares bar lengths, not shades.
 *
 * The bar is `aria-hidden` decoration: the label and the count beside it are
 * real text, so the ranking is fully readable with no colour and no CSS.
 * Label and count share a row with the bar underneath, which is what lets a
 * long game name wrap and reflow on a phone instead of overflowing.
 */
export function RankingBars({ rows, unit }: RankingBarsProps) {
  return (
    <ol data-slot="ranking-bars" className="flex flex-col gap-0.5">
      {rows.map((row) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-small font-medium">
                {row.label}
              </span>
              <span className="shrink-0 font-mono text-caption text-muted-foreground">
                {row.count}
                <span className="sr-only"> {unit}</span>
              </span>
            </div>
            {/* Square at the baseline, rounded at the data end — the bar
                reads as growing from the left edge rather than floating. */}
            <div aria-hidden className="h-2 w-full rounded-sm bg-muted">
              <div
                className="h-full rounded-r-sm bg-primary"
                style={{ width: `${row.share * 100}%` }}
              />
            </div>
            {row.detail ? (
              <span className="text-caption text-muted-foreground">
                {row.detail}
              </span>
            ) : null}
          </>
        );

        const className =
          "flex flex-col gap-1.5 rounded-lg px-2 py-1.5 transition-colors";

        return (
          <li key={row.key}>
            {row.href ? (
              <Link href={row.href} className={`${className} hover:bg-muted`}>
                {body}
              </Link>
            ) : (
              <div className={className}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
