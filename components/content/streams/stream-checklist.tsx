"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  addChecklistItem,
  removeChecklistItem,
  toggleChecklistItem,
} from "@/lib/content/stream-actions";
import type { StreamChecklistItem } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface StreamChecklistProps {
  streamId: string;
  items: StreamChecklistItem[];
}

/** Per-stream checklist: tap-to-toggle rows, inline add/remove — local to this stream, never touches the template (see docs/content-streams.md). */
export function StreamChecklist({ streamId, items }: StreamChecklistProps) {
  const [newLabel, setNewLabel] = useState("");
  const [pending, startTransition] = useTransition();

  function handleToggle(item: StreamChecklistItem, done: boolean) {
    startTransition(async () => {
      const result = await toggleChecklistItem(streamId, item.id, done);
      if (result.error) toast.error(result.error);
    });
  }

  function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    startTransition(async () => {
      const result = await addChecklistItem(streamId, label);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setNewLabel("");
    });
  }

  function handleRemove(item: StreamChecklistItem) {
    startTransition(async () => {
      const result = await removeChecklistItem(streamId, item.id);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div data-slot="stream-checklist" className="flex flex-col gap-2">
      {items.length === 0 ? (
        <p className="text-small text-muted-foreground">
          No checklist items yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5"
            >
              <Checkbox
                aria-label={item.label}
                checked={item.done}
                onCheckedChange={(done) => handleToggle(item, done === true)}
              />
              <span
                className={
                  item.done
                    ? "flex-1 text-small text-muted-foreground line-through"
                    : "flex-1 text-small"
                }
              >
                {item.label}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove "${item.label}"`}
                disabled={pending}
                onClick={() => handleRemove(item)}
              >
                <X aria-hidden className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Input
          aria-label="Add checklist item"
          placeholder="Add an item…"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || !newLabel.trim()}
          onClick={handleAdd}
        >
          <Plus aria-hidden />
          Add
        </Button>
      </div>
    </div>
  );
}
