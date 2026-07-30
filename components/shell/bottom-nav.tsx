import { Inbox, Settings } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { PaletteSearchButton } from "@/components/command-palette/palette-trigger";
import {
  InboxCountBadge,
  inboxCountLabel,
} from "@/components/shell/inbox-count-badge";
import { NavLink } from "@/components/shell/nav-link";
import { navItems } from "@/lib/navigation";

interface BottomNavProps {
  /** Untriaged inbox entries — overlaid as a badge on the Inbox tab. */
  untriagedCount: number;
}

export function BottomNav({ untriagedCount }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {navItems.map(({ href, label, icon: Icon }) => (
        <NavLink
          key={href}
          href={href}
          label={label}
          icon={<Icon aria-hidden className="size-5" />}
          variant="bottom"
        />
      ))}
      {/* Mobile's only persistent inbox entry point since the floating dock
          went away — the sidebar that carries the desktop link is `md:` only
          (Issue #85, see docs/inbox.md). */}
      <NavLink
        href="/inbox"
        label="Inbox"
        icon={<Inbox aria-hidden className="size-5" />}
        variant="bottom"
        badge={
          <InboxCountBadge
            count={untriagedCount}
            className="absolute -top-1 -right-1 h-4 min-w-4 px-1"
          />
        }
        badgeLabel={inboxCountLabel(untriagedCount)}
      />
      <PaletteSearchButton />
      <NavLink
        href="/settings/calendars"
        label="Settings"
        icon={<Settings aria-hidden className="size-5" />}
        variant="bottom"
      />
      <SignOutButton variant="bottom" />
    </nav>
  );
}
