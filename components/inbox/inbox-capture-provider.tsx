"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { CaptureDialog } from "./capture-dialog";

/** Window event any surface can dispatch to pop the capture dialog (used by the command palette). */
export const OPEN_CAPTURE_EVENT = "keystroke:open-capture";

interface InboxCaptureContextValue {
  openCapture: () => void;
}

const InboxCaptureContext = createContext<InboxCaptureContextValue | null>(
  null
);

export function useInboxCapture(): InboxCaptureContextValue {
  const context = useContext(InboxCaptureContext);
  if (!context) {
    throw new Error(
      "useInboxCapture must be used within an InboxCaptureProvider"
    );
  }
  return context;
}

/** Dispatches the global open-capture event — the decoupled way (no shared context needed) for the command palette to trigger capture. */
export function requestOpenCapture(): void {
  window.dispatchEvent(new CustomEvent(OPEN_CAPTURE_EVENT));
}

/**
 * Owns the single, app-wide capture dialog so a thought can be filed from any
 * screen (see docs/inbox.md). Mounted inside the auth-gated shell only —
 * capture must not exist on `/login`. Exposes `openCapture` for the floating
 * capture button, and also opens on the global `OPEN_CAPTURE_EVENT` so the
 * command palette can trigger capture without a context dependency.
 */
export function InboxCaptureProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }
    window.addEventListener(OPEN_CAPTURE_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_CAPTURE_EVENT, handleOpen);
  }, []);

  const value = useMemo<InboxCaptureContextValue>(
    () => ({ openCapture: () => setOpen(true) }),
    []
  );

  return (
    <InboxCaptureContext.Provider value={value}>
      {children}
      <CaptureDialog open={open} onOpenChange={setOpen} />
    </InboxCaptureContext.Provider>
  );
}
