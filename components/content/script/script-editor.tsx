"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ScrollText } from "lucide-react";

import type { Idea, Script } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { ScriptReadingView } from "./script-reading-view";
import { SaveStateIndicator, useScriptAutosave } from "./script-autosave";

type ScriptView = "write" | "read";

interface ScriptEditorProps {
  idea: Idea;
  script: Script | null;
  initialView: ScriptView;
}

/**
 * The dedicated script page: Write/Read tabs (state reflected in the URL) over
 * the shared autosave surface (`useScriptAutosave`). The write surface is a
 * plain `<textarea>`, not a rich editor — native selection/keyboard, zero
 * per-keystroke JS layout, which is what keeps a multi-thousand-word script
 * smooth on mobile (see docs/scripts.md).
 */
export function ScriptEditor({ idea, script, initialView }: ScriptEditorProps) {
  const router = useRouter();
  const pathname = usePathname();

  const { content, saveState, savedAt, handleChange, saveNow } =
    useScriptAutosave(
      idea.id,
      script?.content ?? "",
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
            onRetry={saveNow}
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
            onClick={saveNow}
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
