"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveProjectNotes } from "@/lib/projects/actions";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface ProjectNotesProps {
  projectId: string;
  notes: string;
  disabled?: boolean;
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type NotesView = "write" | "preview";

// Debounce window after the last keystroke before autosave fires — shorter
// than the script editor's (`docs/scripts.md`) since project notes are
// typically short running notes, not a multi-thousand-word script.
const AUTOSAVE_DELAY_MS = 1200;

function SaveStateIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin" />
        Saving…
      </span>
    );
  }
  if (state === "error") {
    return <span className="text-caption text-destructive">Save failed</span>;
  }
  if (state === "dirty") {
    return (
      <span className="text-caption text-muted-foreground">
        Unsaved changes
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <Check aria-hidden className="size-3.5 shrink-0" />
        Saved
      </span>
    );
  }
  return null;
}

/**
 * Running notes — autosaving markdown with a Write/Preview toggle, a smaller-
 * scale sibling of `ScriptEditor` (see docs/projects.md). Disabled once the
 * project is archived (mutations besides "unarchive" are off).
 */
export function ProjectNotes({
  projectId,
  notes,
  disabled = false,
}: ProjectNotesProps) {
  const [view, setView] = useState<NotesView>("write");
  const [content, setContent] = useState(notes);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function triggerSave(value: string) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSaveState("saving");
    startTransition(async () => {
      const result = await saveProjectNotes(projectId, value);
      if (result.error) {
        setSaveState("error");
        toast.error(result.error);
        return;
      }
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

  function handleViewChange(next: unknown) {
    setView(next === "preview" ? "preview" : "write");
  }

  // Don't let a debounced save fire after the component has unmounted.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div data-slot="project-notes" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Tabs value={view} onValueChange={handleViewChange}>
          <TabsList aria-label="Notes view">
            <TabsTrigger value="write" disabled={disabled}>
              Write
            </TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
        </Tabs>
        <SaveStateIndicator state={saveState} />
      </div>

      {view === "write" ? (
        <Textarea
          aria-label="Running notes"
          value={content}
          disabled={disabled}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="What's the plan? What's changed? Jot it down…"
          className="min-h-40 resize-none"
        />
      ) : content.trim() ? (
        <div className="rounded-lg border border-border p-3">
          <MarkdownContent content={content} />
        </div>
      ) : (
        <p className="text-small text-muted-foreground">Nothing written yet.</p>
      )}
    </div>
  );
}
