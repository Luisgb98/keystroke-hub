"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { CommandPalette } from "./command-palette";

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null
);

export function useCommandPalette(): CommandPaletteContextValue {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error(
      "useCommandPalette must be used within a CommandPaletteProvider"
    );
  }
  return context;
}

/**
 * Owns the palette's open state and the global Cmd/Ctrl-K listener. Mounted
 * inside the auth-gated shell layout only — the palette must not exist on
 * `/login`.
 *
 * #85 moved this off Cmd/Ctrl-K onto Cmd/Ctrl-F, on the reasoning that inside
 * the app "search" should mean the palette. #102 moved it back: the script
 * editor is a page of prose, and finding a word inside a script needs the
 * browser's own find-in-page, which only Cmd/Ctrl-F opens. Swallowing it cost
 * more than the palette gained, so the palette takes K — the binding the rest
 * of the world already uses for exactly this.
 *
 * `preventDefault` still fires first: Chrome and Firefox both bind Cmd/Ctrl-K
 * to the address bar's search mode, which would steal focus out of the app.
 */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setOpen((current) => !current);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ open, setOpen }),
    [open]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </CommandPaletteContext.Provider>
  );
}
