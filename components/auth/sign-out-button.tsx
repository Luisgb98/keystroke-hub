import { LogOut } from "lucide-react";

import { logout } from "@/lib/auth/actions";
import {
  BOTTOM_NAV_ICON_CLASSES,
  BOTTOM_NAV_ITEM_CLASSES,
  BOTTOM_NAV_LABEL_CLASSES,
} from "@/components/shell/bottom-nav-styles";
import { Button } from "@/components/ui/button";

interface SignOutButtonProps {
  /** Matches NavLink's placements: sidebar footer vs. mobile bottom bar. */
  variant: "sidebar" | "bottom";
}

export function SignOutButton({ variant }: SignOutButtonProps) {
  if (variant === "bottom") {
    return (
      <form action={logout} className="flex min-w-0 flex-1">
        <button type="submit" className={BOTTOM_NAV_ITEM_CLASSES}>
          <span className={BOTTOM_NAV_ICON_CLASSES}>
            <LogOut aria-hidden className="size-5" />
          </span>
          <span className={BOTTOM_NAV_LABEL_CLASSES}>Sign out</span>
        </button>
      </form>
    );
  }

  return (
    <form action={logout}>
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut aria-hidden className="size-4" />
      </Button>
    </form>
  );
}
