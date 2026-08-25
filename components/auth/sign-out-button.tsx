import { LogOut } from "lucide-react";

import { logout } from "@/lib/auth/actions";
import { MORE_SHEET_ROW_CLASSES } from "@/components/shell/bottom-nav-styles";
import { Button } from "@/components/ui/button";

interface SignOutButtonProps {
  /**
   * Where the button sits: the sidebar footer (desktop) or a row in the mobile
   * bottom nav's "More" sheet (#114 moved it off the tab bar itself).
   */
  variant: "sidebar" | "sheet";
}

export function SignOutButton({ variant }: SignOutButtonProps) {
  if (variant === "sheet") {
    return (
      // A plain form rather than `Button`: this is a server component, so the
      // Server Action goes straight to `<form action>` — and the row has to
      // match the sheet's other rows, not the button system.
      <form action={logout}>
        <button type="submit" className={MORE_SHEET_ROW_CLASSES}>
          <LogOut aria-hidden className="size-5 shrink-0" />
          <span className="flex-1 truncate">Sign out</span>
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
