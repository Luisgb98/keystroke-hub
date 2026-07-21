"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Check, Loader2, ScrollText } from "lucide-react";
import { toast } from "sonner";

import { saveScript } from "@/lib/content/script-actions";
import type { Idea, Script } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { ScriptReadingView } from "./script-reading-view";

type ScriptView = "write" | "read";
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

interface ScriptEditorProps {
  idea: Idea;
  script: Script | null;
  initialView: ScriptView;
}

// Debounce window after the last keystroke before autosave fires (see
// docs/scripts.md).
const AUTOSAVE_DELAY_MS = 1800;

function SaveStateIndicator({
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

/**
 * Write/Read modes, autosave, and the save-state indicator that makes the
 * "no lost work" acceptance criterion observable (see docs/scripts.md).
 * Deliberately a plain `<textarea>` for the write surface, not a rich
 * editor — native selection/keyboard, zero per-keystroke JS layout, which is
 * what keeps a multi-thousand-word script smooth on mobile.
 */
export function ScriptEditor({ idea, script, initialView }: ScriptEditorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [content, setContent] = useState(script?.content ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(
    script?.updatedAt ?? null
  );
  const [view, setView] = useState<ScriptView>(initialView);

  // Adjusts local view state during render when the URL's `view` param
  // changes externally (browser back/forward) — same pattern as
  // `IdeaFilters`' `prevValue` handling, avoiding a "setState in effect"
  // extra render pass.
  const [prevInitialView, setPrevInitialView] = useState(initialView);
  if (initialView !== prevInitialView) {
    setPrevInitialView(initialView);
    setView(initialView);
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors `content` for the Cmd/Ctrl+S handler, whose listener is set up
  // once and would otherwise see a stale value.
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
      const result = await saveScript(idea.id, value);
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

  // Don't let a debounced save fire after the editor has unmounted.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleViewChange(next: unknown) {
    const nextView: ScriptView = next === "read" ? "read" : "write";
    setView(nextView);
    router.replace(nextView === "read" ? `${pathname}?view=read` : pathname, {
      scroll: false,
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ScrollText
              aria-hidden
              className="size-5 shrink-0 text-track-content-foreground"
            />
            <h1 className="truncate font-heading text-h3 font-semibold">
              {idea.title}
            </h1>
          </div>
          <SaveStateIndicator
            state={saveState}
            savedAt={savedAt}
            onRetry={() => triggerSave(contentRef.current)}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Tabs value={view} onValueChange={handleViewChange}>
            <TabsList aria-label="Script view">
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="read">Read</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saveState === "saving"}
            onClick={() => triggerSave(contentRef.current)}
          >
            {saveState === "saving" ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 py-4 sm:px-10 sm:py-6">
        {view === "write" ? (
          <Textarea
            aria-label="Script"
            value={content}
            onChange={(event) => handleChange(event.target.value)}
            placeholder="Write your script in Markdown…"
            className="min-h-[60vh] flex-1 resize-none font-sans text-base leading-relaxed md:text-base"
          />
        ) : (
          <ScriptReadingView content={content} />
        )}
      </div>
    </div>
  );
}
