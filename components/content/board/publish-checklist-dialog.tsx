"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  addIdeaChecklistItem,
  getIdeaChecklistItems,
  removeIdeaChecklistItem,
  toggleIdeaChecklistItem,
} from "@/lib/content/checklist-actions";
import type { IdeaChecklistItem } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface PublishChecklistDialogProps {
  ideaId: string;
  ideaTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The publish checklist's editable body: tap-to-toggle rows, inline add/
 * remove — same idiom as `StreamChecklist`, wrapped in a `Dialog` since it's
 * opened from a board card rather than a full page (see docs/content-ideas.md).
 * Items are fetched on open via a Server Action (this project's shadcn setup
 * has no client-safe way to import the `server-only` data layer directly —
 * same reasoning as `IdeaLinkPicker`'s `searchLinkableIdeas` call).
 */
export function PublishChecklistDialog({
  ideaId,
  ideaTitle,
  open,
  onOpenChange,
}: PublishChecklistDialogProps) {
  const [items, setItems] = useState<IdeaChecklistItem[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [pending, startTransition] = useTransition();

  // Reset the add-item input on close, adjusting state during render rather
  // than in an effect — same pattern as `IdeaLinkPicker`'s `prevOpen` tracking.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setNewLabel("");
  }

  // Which idea `items` was fetched for while open — a mismatch (or `open`
  // going from closed to open) means a fetch is in flight, so "loading" is
  // derived rather than a separate setState call at the top of the effect
  // body (avoids react-hooks/set-state-in-effect's cascading-render
  // warning) — same pattern as `IdeaLinkPicker`'s `resultsKey`.
  const [itemsIdeaId, setItemsIdeaId] = useState<string | null>(null);
  const loading = open && itemsIdeaId !== ideaId;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getIdeaChecklistItems(ideaId).then((fetched) => {
      if (cancelled) return;
      setItems(fetched);
      setItemsIdeaId(ideaId);
    });
    return () => {
      cancelled = true;
    };
  }, [open, ideaId]);

  function handleToggle(item: IdeaChecklistItem, done: boolean) {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, done } : i))
    );
    startTransition(async () => {
      const result = await toggleIdeaChecklistItem(ideaId, item.id, done);
      if (result.error) toast.error(result.error);
    });
  }

  function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    startTransition(async () => {
      const result = await addIdeaChecklistItem(ideaId, label);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setNewLabel("");
      const fetched = await getIdeaChecklistItems(ideaId);
      setItems(fetched);
    });
  }

  function handleRemove(item: IdeaChecklistItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(async () => {
      const result = await removeIdeaChecklistItem(ideaId, item.id);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish checklist</DialogTitle>
          <DialogDescription>{ideaTitle}</DialogDescription>
        </DialogHeader>

        <div data-slot="publish-checklist" className="flex flex-col gap-2">
          {loading ? (
            <p className="py-6 text-center text-small text-muted-foreground">
              Loading…
            </p>
          ) : items.length === 0 ? (
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
                    onCheckedChange={(done) =>
                      handleToggle(item, done === true)
                    }
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
      </DialogContent>
    </Dialog>
  );
}
