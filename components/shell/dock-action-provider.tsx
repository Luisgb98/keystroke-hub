"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";

/**
 * A page-supplied primary action that takes over the floating dock button on
 * the current screen (e.g. "New idea" on /content/ideas). The dock renders
 * exactly one primary FAB: this action when a page registers it, otherwise the
 * global quick-capture button — never both stacked (see Issue #74 and
 * docs/inbox.md).
 */
export interface DockAction {
  /** Button text, also its accessible name (e.g. "New idea"). */
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}

interface DockActionContextValue {
  /** The active page action, or null when the dock shows global capture. */
  action: DockAction | null;
  /** Register a page action under a stable id; returns an unregister cleanup. */
  registerAction: (id: string, action: DockAction) => () => void;
}

const DockActionContext = createContext<DockActionContextValue | null>(null);

function useDockActionContext(): DockActionContextValue {
  const context = useContext(DockActionContext);
  if (!context) {
    throw new Error("useDockAction must be used within a DockActionProvider");
  }
  return context;
}

/** Read the currently active dock action — consumed by the capture dock. */
export function useDockAction(): DockAction | null {
  return useDockActionContext().action;
}

/**
 * Register this component's primary action with the dock for as long as it's
 * mounted; the action clears automatically on unmount (i.e. when the route
 * changes). `label`/`icon` are stable per screen, so they can key the effect
 * safely; `onSelect` flows through a ref so a fresh closure each render doesn't
 * thrash the registry.
 */
export function useRegisterDockAction(
  label: string,
  icon: LucideIcon,
  onSelect: () => void
): void {
  const id = useId();
  const { registerAction } = useDockActionContext();
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    return registerAction(id, {
      label,
      icon,
      onSelect: () => onSelectRef.current(),
    });
  }, [id, registerAction, label, icon]);
}

/**
 * Owns the single page-action slot the capture dock reads from. Mounted in the
 * `(app)` shell wrapping both the page content and the dock, so a page can
 * register its primary action and the dock can render it. Kept as a stack keyed
 * by id — only one page action mounts at a time, but last-registrant-wins means
 * a brief route-transition overlap can never leave a stale action showing.
 */
export function DockActionProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<
    Array<{ id: string; action: DockAction }>
  >([]);

  const registerAction = useCallback((id: string, action: DockAction) => {
    setEntries((prev) => [...prev.filter((e) => e.id !== id), { id, action }]);
    return () => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    };
  }, []);

  const action = entries.length > 0 ? entries[entries.length - 1].action : null;

  const value = useMemo<DockActionContextValue>(
    () => ({ action, registerAction }),
    [action, registerAction]
  );

  return (
    <DockActionContext.Provider value={value}>
      {children}
    </DockActionContext.Provider>
  );
}
