import { SignOutButton } from "@/components/auth/sign-out-button";
import { NavLink } from "@/components/shell/nav-link";
import { navItems } from "@/lib/navigation";

export function BottomNav() {
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
      <SignOutButton variant="bottom" />
    </nav>
  );
}
