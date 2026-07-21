import Link from "next/link";
import { Inbox, Settings } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { PaletteTriggerChip } from "@/components/command-palette/palette-trigger";
import { NavLink } from "@/components/shell/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/navigation";

interface SidebarProps {
  /** Untriaged inbox entries — rendered as a badge on the Inbox link. */
  untriagedCount: number;
}

export function Sidebar({ untriagedCount }: SidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border md:flex">
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
          href="/inbox"
          label="Inbox"
          icon={<Inbox aria-hidden className="size-5" />}
          variant="sidebar"
          badge={
            untriagedCount > 0 ? (
              <span
                data-slot="inbox-count"
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-caption font-semibold text-primary-foreground tabular-nums"
              >
                {untriagedCount}
              </span>
            ) : undefined
          }
        />
      </nav>

      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <span className="text-caption text-muted-foreground">Theme</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            nativeButton={false}
            render={<Link href="/settings/calendars" />}
          >
            <Settings aria-hidden />
          </Button>
          <ThemeToggle />
          <SignOutButton variant="sidebar" />
        </div>
      </div>
    </aside>
  );
}
