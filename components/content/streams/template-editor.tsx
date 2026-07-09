"use client";

import { useState, useTransition } from "react";
import { Plus, Settings2, X } from "lucide-react";
import { toast } from "sonner";

import {
  addTemplateItem,
  removeTemplateItem,
} from "@/lib/content/stream-actions";
import type { StreamChecklistTemplateItem } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface TemplateEditorProps {
  items: StreamChecklistTemplateItem[];
}

/**
 * Reachable from `/content/streams` — editing the default checklist only
 * affects streams created afterward (copy-on-create), never an existing
 * stream's checklist (see docs/content-streams.md).
 */
export function TemplateEditor({ items }: TemplateEditorProps) {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    startTransition(async () => {
      const result = await addTemplateItem(label);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setNewLabel("");
    });
  }

  function handleRemove(item: StreamChecklistTemplateItem) {
    startTransition(async () => {
      const result = await removeTemplateItem(item.id);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Settings2 aria-hidden />
        Default checklist
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Default checklist</DialogTitle>
            <DialogDescription>
              Applies to future streams only — editing this never changes an
              existing stream&apos;s checklist.
            </DialogDescription>
          </DialogHeader>

          {items.length === 0 ? (
            <p className="text-small text-muted-foreground">
              No default items yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <span className="flex-1 text-small">{item.label}</span>
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
              aria-label="Add default checklist item"
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
        </DialogContent>
      </Dialog>
    </>
  );
}
