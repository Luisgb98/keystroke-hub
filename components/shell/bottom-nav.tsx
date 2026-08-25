import { SignOutButton } from "@/components/auth/sign-out-button";
import { BOTTOM_NAV_BAR_CLASSES } from "@/components/shell/bottom-nav-styles";
import { MoreSheet } from "@/components/shell/more-sheet";
import { NavLink } from "@/components/shell/nav-link";
import { bottomNavItems } from "@/lib/navigation";

interface BottomNavProps {
  /** Untriaged inbox entries — a dot on the More trigger, the count on its Inbox row. */
  untriagedCount: number;
}

/**
 * The mobile tab bar: four destinations plus "More" (#114).
 *
 * It used to carry nine items — the five `navItems`, Inbox, Search, Settings
 * and Sign out — which left ~42px per slot and wrapped labels across three
 * lines. The five that no longer have a slot moved into `MoreSheet`, one tap
 * away, and the inbox count is mirrored on the More trigger so mobile keeps a
 * permanently visible untriaged signal (docs/inbox.md).
 */
export function BottomNav({ untriagedCount }: BottomNavProps) {
  return (
    <nav aria-label="Primary" className={BOTTOM_NAV_BAR_CLASSES}>
      {bottomNavItems.map(({ href, label, icon: Icon }) => (
        <NavLink
          key={href}
          href={href}
          label={label}
          icon={<Icon aria-hidden className="size-5" />}
          variant="bottom"
        />
      ))}
      {/* The sign-out form is a server component (it hands a Server Action to
          `<form action>`), so it's passed into the client sheet as a slot
          rather than imported there. */}
      <MoreSheet untriagedCount={untriagedCount}>
        <SignOutButton variant="sheet" />
      </MoreSheet>
    </nav>
  );
}
