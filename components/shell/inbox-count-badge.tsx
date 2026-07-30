import { cn } from "@/lib/utils";

interface InboxCountBadgeProps {
  /** Untriaged entries — nothing renders at zero, so "inbox zero" stays quiet. */
  count: number;
  /** Size/position overrides; the bottom nav overlays a tighter pill on the tab icon. */
  className?: string;
}

/**
 * The untriaged-inbox count, shared by the sidebar's Inbox link and the bottom
 * nav's Inbox tab so the two can't drift (Issue #85 made the count a nav
 * concern on both viewports, see docs/inbox.md). Purely visual — pair it with
 * `inboxCountLabel` on `NavLink`'s `badgeLabel` so the count is announced in
 * label order rather than wherever the pill happens to sit.
 */
export function InboxCountBadge({ count, className }: InboxCountBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      aria-hidden
      data-slot="inbox-count"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-caption font-semibold text-primary-foreground tabular-nums",
        className
      )}
    >
      {count}
    </span>
  );
}

/** Screen-reader wording for the badge — `undefined` at inbox zero, matching the badge. */
export function inboxCountLabel(count: number): string | undefined {
  return count > 0 ? `${count} to triage` : undefined;
}
