"use client";

import { useSyncExternalStore } from "react";
import { Search } from "lucide-react";

import { useCommandPalette } from "@/components/command-palette/command-palette-provider";

function subscribeNever() {
  return () => {};
}

/** Mac detection, resolved client-only via `useSyncExternalStore` — same no-setState-in-effect idiom as `useMounted` in `theme-toggle.tsx`. */
function useModifierKeyLabel(): string {
  const isMac = useSyncExternalStore(
    subscribeNever,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent),
    () => false
  );
  return isMac ? "⌘" : "Ctrl";
}

/** Sidebar chip — visible search affordance plus the ⌘K/Ctrl K hint (see docs/command-palette.md). */
export function PaletteTriggerChip() {
  const { setOpen } = useCommandPalette();
  const modifierLabel = useModifierKeyLabel();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Search"
      className="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-input/30 px-3 text-small text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Search aria-hidden className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">Search</span>
      <kbd className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-caption">
        {`${modifierLabel}K`}
      </kbd>
    </button>
  );
}

/** Bottom-nav search button — mirrors `NavLink`'s "bottom" variant and `SignOutButton`'s bottom form (see docs/command-palette.md). */
export function PaletteSearchButton() {
  const { setOpen } = useCommandPalette();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-caption font-medium text-muted-foreground transition-colors duration-motion-fast ease-motion-standard"
    >
      <span className="flex items-center justify-center rounded-lg px-3 py-1">
        <Search aria-hidden className="size-5" />
      </span>
      <span className="text-center leading-tight text-balance">Search</span>
    </button>
  );
}
