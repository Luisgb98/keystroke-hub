"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveScript } from "@/lib/content/script-actions";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

// Debounce window after the last keystroke before autosave fires (see
// docs/scripts.md).
export const AUTOSAVE_DELAY_MS = 1800;

export interface ScriptAutosave {
  content: string;
  saveState: SaveState;
  savedAt: Date | null;
  /** Wire to the textarea's `onChange` value — updates content and schedules a debounced save. */
  handleChange: (value: string) => void;
  /** Saves the current content immediately, bypassing the debounce (Save button, Cmd/Ctrl+S, leaving edit mode). */
  saveNow: () => void;
}

/**
 * The script write surface's shared behavior — autosave with a debounce,
 * the observable save-state machine, an immediate save (Cmd/Ctrl+S and an
 * explicit control), and a `beforeunload` guard so a pending or in-flight
 * save can't be silently lost (the "no lost work" acceptance criterion — see
 * docs/scripts.md). Both the dedicated `ScriptEditor` page and the idea
 * detail page's inline `IdeaScriptSection` mount this, so the two surfaces
 * stay behaviorally identical.
 */
export function useScriptAutosave(
  ideaId: string,
  initialContent: string,
  initialSavedAt: Date | null
): ScriptAutosave {
  const [, startTransition] = useTransition();
  const [content, setContent] = useState(initialContent);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(initialSavedAt);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors `content` for the once-registered Cmd/Ctrl+S handler, which would
  // otherwise close over a stale value.
  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  function triggerSave(value: string) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSaveState("saving");
    startTransition(async () => {
      const result = await saveScript(ideaId, value);
      if (result.error) {
        setSaveState("error");
        toast.error(result.error);
        return;
      }
      setSavedAt(result.updatedAt ?? new Date());
      setSaveState("saved");
    });
  }

  function handleChange(value: string) {
    setContent(value);
    setSaveState("dirty");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => triggerSave(value),
      AUTOSAVE_DELAY_MS
    );
  }

  function saveNow() {
    triggerSave(contentRef.current);
  }

  // Cmd/Ctrl+S saves immediately, bypassing the debounce.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        triggerSave(contentRef.current);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A pending or in-flight save must not be silently lost to a closed tab —
  // the "no lost work" acceptance criterion (see docs/scripts.md).
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (saveState === "dirty" || saveState === "saving") {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveState]);

  // Don't let a debounced save fire after the surface has unmounted.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { content, saveState, savedAt, handleChange, saveNow };
}

/**
 * The visible save-state readout — `Unsaved changes` → `Saving…` →
 * `Saved HH:MM`, or a retry affordance on error — that makes the "no lost
 * work" contract observable on every script surface.
 */
export function SaveStateIndicator({
  state,
  savedAt,
  onRetry,
}: {
  state: SaveState;
  savedAt: Date | null;
  onRetry: () => void;
}) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin" />
        Saving…
      </span>
    );
  }

  if (state === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="text-caption font-medium text-destructive underline underline-offset-2"
      >
        Save failed — retry
      </button>
    );
  }

  if (state === "dirty") {
    return (
      <span className="text-caption text-muted-foreground">
        Unsaved changes
      </span>
    );
  }

  if (savedAt) {
    return (
      <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
        {state === "saved" ? (
          <Check aria-hidden className="size-3.5 shrink-0" />
        ) : null}
        Saved {format(savedAt, "HH:mm")}
      </span>
    );
  }

  return null;
}
