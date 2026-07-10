"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { saveRetro } from "@/lib/journal/actions";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const AUTOSAVE_DELAY_MS = 800;

interface RetroCardProps {
  logDate: string;
  retro: string | null;
}

type SaveStatus = "idle" | "saving" | "saved";

/** End-of-day free text with debounced autosave (see docs/journal.md). */
export function RetroCard({ logDate, retro }: RetroCardProps) {
  const [value, setValue] = useState(retro ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const savedValueRef = useRef(retro ?? "");

  useEffect(() => {
    if (value === savedValueRef.current) return;

    setStatus("saving");
    const timeout = setTimeout(async () => {
      const result = await saveRetro(logDate, value);
      if (result.error) {
        toast.error(result.error);
        setStatus("idle");
        return;
      }
      savedValueRef.current = value;
      setStatus("saved");
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [value, logDate]);

  return (
    <div data-slot="retro-card" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="journal-retro-field">How did today go?</Label>
        <span className="text-caption text-muted-foreground" aria-live="polite">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
        </span>
      </div>
      <Textarea
        id="journal-retro-field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Quick end-of-day notes…"
      />
    </div>
  );
}
