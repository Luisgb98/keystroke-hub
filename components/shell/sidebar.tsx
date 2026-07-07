import Link from "next/link";
import { Settings } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { NavLink } from "@/components/shell/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/navigation";

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border md:flex">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="font-heading text-h3 font-semibold">Keystroke</span>
          <span className="font-mono text-small text-primary">Hub</span>
        </Link>
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
      </nav>

      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <span className="text-caption text-muted-foreground">Theme</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
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
