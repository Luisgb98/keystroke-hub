"use client";

import { useSyncExternalStore } from "react";
import { Search } from "lucide-react";

import { useCommandPalette } from "@/components/command-palette/command-palette-provider";
import {
  BOTTOM_NAV_ICON_CLASSES,
  BOTTOM_NAV_ITEM_CLASSES,
  BOTTOM_NAV_LABEL_CLASSES,
} from "@/components/shell/bottom-nav-styles";
import { Button } from "@/components/ui/button";

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

/** Sidebar chip — visible search affordance plus the ⌘F/Ctrl F hint (see docs/command-palette.md). */
export function PaletteTriggerChip() {
  const { setOpen } = useCommandPalette();
  const modifierLabel = useModifierKeyLabel();

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={() => setOpen(true)}
      aria-label="Search"
      className="w-full min-w-0 justify-start gap-2 px-3 font-normal text-muted-foreground hover:text-foreground"
    >
      <Search aria-hidden className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">Search</span>
      <kbd className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-caption">
        {`${modifierLabel}F`}
      </kbd>
    </Button>
  );
}

/**
 * Bottom-nav search button — sits in the same row as `NavLink`'s "bottom"
 * variant and `SignOutButton`'s bottom form, so it shares `NavLink`'s exported
 * item classes rather than restating them (see docs/command-palette.md).
 */
export function PaletteSearchButton() {
  const { setOpen } = useCommandPalette();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={BOTTOM_NAV_ITEM_CLASSES}
    >
      <span className={BOTTOM_NAV_ICON_CLASSES}>
        <Search aria-hidden className="size-5" />
      </span>
      <span className={BOTTOM_NAV_LABEL_CLASSES}>Search</span>
    </button>
  );
}
