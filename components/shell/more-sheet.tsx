"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, Search } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useCommandPalette } from "@/components/command-palette/command-palette-provider";
import {
  BOTTOM_NAV_ICON_CLASSES,
  BOTTOM_NAV_ITEM_CLASSES,
  BOTTOM_NAV_LABEL_CLASSES,
  MORE_SHEET_ROW_CLASSES,
} from "@/components/shell/bottom-nav-styles";
import {
  InboxCountBadge,
  inboxCountLabel,
} from "@/components/shell/inbox-count-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  isMoreNavActive,
  isNavItemActive,
  moreNavItems,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface MoreSheetProps {
  /** Untriaged inbox entries — shown on the Inbox row and mirrored as a dot on the trigger. */
  untriagedCount: number;
  /**
   * The sign-out form. It's a server component (it hands a Server Action to
   * `<form action>`), so it can't be imported here — the bottom nav, which is
   * a server component itself, passes it down as a slot.
   */
  children: ReactNode;
}

/**
 * The fifth slot in the mobile tab bar and everything behind it (#114).
 *
 * The bar can hold five items before labels wrap and tap targets get cramped,
 * and the app has more than five destinations — so four get a slot and the
 * rest get a bottom sheet one tap away: Projects & Meetings, Inbox, Settings,
 * Search (the command palette) and Sign out. Nothing became unreachable; the
 * row just stopped pretending nine things fit in it.
 *
 * The untriaged count is mirrored as a dot on the trigger, because
 * `docs/inbox.md` promises the count is visible on mobile at all times and the
 * Inbox tab that used to carry it now lives inside the sheet.
 */
export function MoreSheet({ untriagedCount, children }: MoreSheetProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { setOpen: setPaletteOpen } = useCommandPalette();
  const active = isMoreNavActive(pathname);
  const countLabel = inboxCountLabel(untriagedCount);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={countLabel ? `More, ${countLabel}` : undefined}
        className={cn(BOTTOM_NAV_ITEM_CLASSES, active && "text-foreground")}
      >
        <span className={cn(BOTTOM_NAV_ICON_CLASSES, active && "bg-secondary")}>
          <Ellipsis aria-hidden className="size-5" />
          {untriagedCount > 0 && (
            // A dot, not the number: the count itself is on the Inbox row one
            // tap away, and "something is waiting" is all the bar needs to say.
            <span
              aria-hidden
              data-slot="more-unread-dot"
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary"
            />
          )}
          {active && (
            <span
              aria-hidden
              className="absolute -bottom-1 size-1 rounded-full bg-primary"
            />
          )}
        </span>
        <span className={BOTTOM_NAV_LABEL_CLASSES}>More</span>
      </SheetTrigger>

      <SheetContent aria-label="More destinations">
        <div className="flex flex-col gap-1">
          <SheetTitle>More</SheetTitle>
          <SheetDescription>
            Everything that doesn&apos;t fit the tab bar.
          </SheetDescription>
        </div>

        <nav aria-label="More" className="flex flex-col gap-1">
          {moreNavItems.map(({ href, label, icon: Icon }) => {
            const isInbox = href === "/inbox";
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={
                  isNavItemActive(pathname, href) ? "page" : undefined
                }
                aria-label={
                  isInbox && countLabel ? `${label}, ${countLabel}` : undefined
                }
                className={cn(
                  MORE_SHEET_ROW_CLASSES,
                  isNavItemActive(pathname, href) && "bg-secondary"
                )}
              >
                <Icon aria-hidden className="size-5 shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {isInbox && <InboxCountBadge count={untriagedCount} />}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => {
              // Close first: two stacked modals would fight over the focus
              // trap, and the palette is the one that should win.
              setOpen(false);
              setPaletteOpen(true);
            }}
            className={MORE_SHEET_ROW_CLASSES}
          >
            <Search aria-hidden className="size-5 shrink-0" />
            <span className="flex-1 truncate">Search</span>
          </button>

          {children}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
