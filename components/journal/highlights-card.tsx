"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { saveHighlights } from "@/lib/journal/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const AUTOSAVE_DELAY_MS = 800;

interface HighlightsCardProps {
  weekStart: string;
  highlights: string;
}

type SaveStatus = "idle" | "saving" | "saved";

/** The lead paragraph of the spoken review — free text, debounced autosave, keyed by weekStart so drafts reset on navigation (see docs/journal.md). */
export function HighlightsCard({ weekStart, highlights }: HighlightsCardProps) {
  const [value, setValue] = useState(highlights);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const savedValueRef = useRef(highlights);

  useEffect(() => {
    if (value === savedValueRef.current) return;

    setStatus("saving");
    const timeout = setTimeout(async () => {
      const result = await saveHighlights(weekStart, value);
      if (result.error) {
        toast.error(result.error);
        setStatus("idle");
        return;
      }
      savedValueRef.current = value;
      setStatus("saved");
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [value, weekStart]);

  return (
    <Card data-slot="highlights-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Highlights</CardTitle>
        <span className="text-caption text-muted-foreground" aria-live="polite">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
        </span>
      </CardHeader>
      <CardContent>
        <Textarea
          aria-label="Highlights"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Pull out the key items of the week…"
        />
      </CardContent>
    </Card>
  );
}
