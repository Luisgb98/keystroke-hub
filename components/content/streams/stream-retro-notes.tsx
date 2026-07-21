"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveRetroNotes } from "@/lib/content/stream-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface StreamRetroNotesProps {
  streamId: string;
  retroNotes: string | null;
}

/** Post-stream quick notes — plain free text, always editable (see docs/content-streams.md). */
export function StreamRetroNotes({
  streamId,
  retroNotes,
}: StreamRetroNotesProps) {
  const [value, setValue] = useState(retroNotes ?? "");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await saveRetroNotes(streamId, value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved");
    });
  }

  return (
    <div data-slot="stream-retro-notes" className="flex flex-col gap-2">
      <Label htmlFor="stream-retro-notes-field">How did it go?</Label>
      <Textarea
        id="stream-retro-notes-field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Quick notes for next time…"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        className="self-start"
        onClick={handleSave}
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
