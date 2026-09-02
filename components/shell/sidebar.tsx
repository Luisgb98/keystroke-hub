import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { PaletteTriggerChip } from "@/components/command-palette/palette-trigger";
import {
  InboxCountBadge,
  inboxCountLabel,
} from "@/components/shell/inbox-count-badge";
import { NavLink } from "@/components/shell/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { inboxNavItem, navItems, settingsNavItem } from "@/lib/navigation";

interface SidebarProps {
  /** Untriaged inbox entries — rendered as a badge on the Inbox link. */
  untriagedCount: number;
}

export function Sidebar({ untriagedCount }: SidebarProps) {
  // The shell caps this to the viewport height (issue #87), so on an absurdly
  // short window the nav would outgrow it. `overflow-y-auto` keeps the
  // theme/settings footer reachable there instead of clipping it — on any
  // normal window there is nothing to overflow, so the sidebar still can't
  // scroll or change size.
  return (
    <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-border md:flex">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="font-heading text-h3 font-semibold">Keystroke</span>
          <span className="font-mono text-small text-primary">Hub</span>
        </Link>
      </div>

      <div className="px-3 pb-3">
        <PaletteTriggerChip />
      </div>

      <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={<Icon aria-hidden className="size-5" />}
            variant="sidebar"
          />
        ))}
        <NavLink
          href={inboxNavItem.href}
          label={inboxNavItem.label}
          icon={<inboxNavItem.icon aria-hidden className="size-5" />}
          variant="sidebar"
          badge={<InboxCountBadge count={untriagedCount} className="ml-auto" />}
          badgeLabel={inboxCountLabel(untriagedCount)}
        />
      </nav>

      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <span className="text-caption text-muted-foreground">Theme</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={settingsNavItem.label}
            nativeButton={false}
            render={<Link href={settingsNavItem.href} />}
          >
            <settingsNavItem.icon aria-hidden />
          </Button>
          <ThemeToggle />
          <SignOutButton variant="sidebar" />
        </div>
      </div>
    </aside>
  );
}
