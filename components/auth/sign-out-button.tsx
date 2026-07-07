import { LogOut } from "lucide-react";

import { logout } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

interface SignOutButtonProps {
  /** Matches NavLink's placements: sidebar footer vs. mobile bottom bar. */
  variant: "sidebar" | "bottom";
}

export function SignOutButton({ variant }: SignOutButtonProps) {
  if (variant === "bottom") {
    return (
      <form action={logout} className="flex min-w-0 flex-1">
        <button
          type="submit"
          className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-caption font-medium text-muted-foreground transition-colors duration-motion-fast ease-motion-standard"
        >
          <span className="flex items-center justify-center rounded-lg px-3 py-1">
            <LogOut aria-hidden className="size-5" />
          </span>
          <span className="text-center leading-tight text-balance">
            Sign out
          </span>
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
