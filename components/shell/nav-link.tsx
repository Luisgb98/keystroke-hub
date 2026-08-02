"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isNavItemActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import {
  BOTTOM_NAV_ICON_CLASSES,
  BOTTOM_NAV_ITEM_CLASSES,
  BOTTOM_NAV_LABEL_CLASSES,
} from "@/components/shell/bottom-nav-styles";

interface NavLinkProps {
  href: string;
  label: string;
  icon: ReactNode;
  variant: "sidebar" | "bottom";
  /**
   * Optional count adornment (e.g. the inbox count) — **visual only**, so pass
   * an `aria-hidden` node and spell the count out in `badgeLabel`. The sidebar
   * trails it after the label; the bottom variant, where a trailing chip has no
   * room, sits it on the tab icon, which puts it *before* the label in DOM
   * order — hence the split: `badgeLabel` names the link outright, so both
   * variants announce "Inbox, 3 to triage" instead of "3Inbox" (Issue #85).
   */
  badge?: ReactNode;
  /** Screen-reader wording for `badge`, e.g. "3 to triage". */
  badgeLabel?: string;
}

export function NavLink({
  href,
  label,
  icon,
  variant,
  badge,
  badgeLabel,
}: NavLinkProps) {
  const pathname = usePathname();
  const active = isNavItemActive(pathname, href);
  const accessibleName = badgeLabel ? `${label}, ${badgeLabel}` : undefined;

  if (variant === "bottom") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={accessibleName}
        className={cn(BOTTOM_NAV_ITEM_CLASSES, active && "text-foreground")}
      >
        <span className={cn(BOTTOM_NAV_ICON_CLASSES, active && "bg-secondary")}>
          {icon}
          {badge}
          {active && (
            <span
              aria-hidden
              className="absolute -bottom-1 size-1 rounded-full bg-primary"
            />
          )}
        </span>
        <span className={BOTTOM_NAV_LABEL_CLASSES}>{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={accessibleName}
      className={cn(
        "relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-small font-medium text-muted-foreground transition-colors duration-motion-fast ease-motion-standard hover:bg-secondary hover:text-foreground",
        active &&
          "bg-secondary text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary before:content-['']"
      )}
    >
      {icon}
      <span>{label}</span>
      {badge}
    </Link>
  );
}
