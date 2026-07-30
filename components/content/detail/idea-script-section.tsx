"use client";

import { useState } from "react";
import { Check, Pencil } from "lucide-react";

import type { Script } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  SaveStateIndicator,
  useScriptAutosave,
} from "@/components/content/script/script-autosave";
import { ScriptReadingView } from "@/components/content/script/script-reading-view";

interface IdeaScriptSectionProps {
  ideaId: string;
  script: Script | null;
}

/**
 * The idea detail page's script surface (#73): the Markdown script is rendered
 * read-only by default — the creator's default posture is reading their own
 * content (e.g. while recording) — and an explicit **Edit** button reveals the
 * autosaving write surface. Editing chrome is visible only while editing;
 * **Done** flushes any pending save and returns to the rendered view. The write
 * surface reuses the shared `useScriptAutosave` behavior, so it's identical to
 * the dedicated `ScriptEditor` page (see docs/scripts.md).
 */
export function IdeaScriptSection({ ideaId, script }: IdeaScriptSectionProps) {
  const [editing, setEditing] = useState(false);
  const { content, saveState, savedAt, handleChange, saveNow } =
    useScriptAutosave(ideaId, script?.content ?? "", script?.updatedAt ?? null);

  function leaveEditMode() {
    // The rendered view already reflects `content`; this just flushes a
    // still-pending debounced edit so it's persisted, not lost.
    if (saveState === "dirty") saveNow();
    setEditing(false);
  }

  const hasContent = content.trim().length > 0;

  return (
    <section data-slot="idea-script-section" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-small font-semibold">Script</h2>
        {editing ? (
          <div className="flex items-center gap-3">
            <SaveStateIndicator
              state={saveState}
              savedAt={savedAt}
              onRetry={saveNow}
            />
            <Button type="button" size="sm" onClick={leaveEditMode}>
              <Check aria-hidden className="size-4" />
              Done
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden className="size-4" />
            Edit
          </Button>
        )}
      </div>

      {editing ? (
        <Textarea
          aria-label="Script"
          autoFocus
          value={content}
          onChange={(event) => handleChange(event.target.value)}
          placeholder="Write your script in Markdown…"
          className="min-h-[60vh] flex-1 resize-none font-sans text-base leading-relaxed md:text-base"
        />
      ) : hasContent ? (
        <ScriptReadingView content={content} />
      ) : (
        <p className="text-body text-muted-foreground">
          No script yet — tap Edit to write one.
        </p>
      )}
    </section>
  );
}
