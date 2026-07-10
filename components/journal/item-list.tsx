"use client";

import { useOptimistic, useTransition } from "react";
import { CornerDownRight, X } from "lucide-react";
import { toast } from "sonner";

import {
  deleteItem,
  rolloverAllUnfinished,
  rolloverItem,
  toggleItem,
} from "@/lib/journal/actions";
import type { DailyLogItem } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface ItemListProps {
  logDate: string;
  items: DailyLogItem[];
}

type OptimisticAction =
  | { type: "toggle"; id: string; done: boolean }
  | { type: "remove"; id: string }
  | { type: "rollover"; id: string }
  | { type: "rolloverAll"; ids: string[] };

function reduce(
  items: DailyLogItem[],
  action: OptimisticAction
): DailyLogItem[] {
  switch (action.type) {
    case "toggle":
      return items.map((item) =>
        item.id === action.id
          ? {
              ...item,
              status: action.done ? "done" : "planned",
              completedAt: action.done ? new Date() : null,
            }
          : item
      );
    case "remove":
      return items.filter((item) => item.id !== action.id);
    case "rollover":
      return items.map((item) =>
        item.id === action.id ? { ...item, status: "rolled_over" } : item
      );
    case "rolloverAll":
      return items.map((item) =>
        action.ids.includes(item.id) ? { ...item, status: "rolled_over" } : item
      );
  }
}

/**
 * Planned + done sections for a day, with optimistic check-off, per-item
 * rollover, "roll over all unfinished", and removal (see docs/journal.md).
 * `useOptimistic` mirrors `PipelineBoard`'s pattern: a failed action settles
 * without a revalidated `items` prop, so React's own rollback reverts it.
 */
export function ItemList({ logDate, items }: ItemListProps) {
  const [optimisticItems, applyAction] = useOptimistic(items, reduce);
  const [, startTransition] = useTransition();

  const byPosition = (a: DailyLogItem, b: DailyLogItem) =>
    a.position - b.position;
  const planned = optimisticItems
    .filter((item) => item.status === "planned")
    .sort(byPosition);
  const done = optimisticItems
    .filter((item) => item.status === "done")
    .sort(byPosition);
  const rolledOver = optimisticItems
    .filter((item) => item.status === "rolled_over")
    .sort(byPosition);

  function handleToggle(item: DailyLogItem, isDone: boolean) {
    startTransition(async () => {
      applyAction({ type: "toggle", id: item.id, done: isDone });
      const result = await toggleItem(item.id, isDone);
      if (result.error) toast.error(result.error);
    });
  }

  function handleRemove(item: DailyLogItem) {
    startTransition(async () => {
      applyAction({ type: "remove", id: item.id });
      const result = await deleteItem(item.id);
      if (result.error) toast.error(result.error);
    });
  }

  function handleRollover(item: DailyLogItem) {
    startTransition(async () => {
      applyAction({ type: "rollover", id: item.id });
      const result = await rolloverItem(item.id, logDate);
      if (result.error) toast.error(result.error);
    });
  }

  function handleRolloverAll() {
    const ids = planned.map((item) => item.id);
    startTransition(async () => {
      applyAction({ type: "rolloverAll", ids });
      const result = await rolloverAllUnfinished(logDate);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div data-slot="journal-item-list" className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-small font-semibold">Plan</h2>
          {planned.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleRolloverAll}
            >
              Roll over all unfinished
            </Button>
          ) : null}
        </div>
        {planned.length === 0 && rolledOver.length === 0 ? (
          <p className="text-small text-muted-foreground">
            Nothing planned yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {planned.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5"
              >
                <Checkbox
                  aria-label={item.title}
                  checked={false}
                  onCheckedChange={(checked) =>
                    handleToggle(item, checked === true)
                  }
                  className="size-5"
                />
                <span className="flex-1 text-small">{item.title}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Roll "${item.title}" over to tomorrow`}
                  onClick={() => handleRollover(item)}
                >
                  <CornerDownRight aria-hidden className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove "${item.title}"`}
                  onClick={() => handleRemove(item)}
                >
                  <X aria-hidden className="size-3.5" />
                </Button>
              </li>
            ))}
            {rolledOver.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-muted-foreground"
              >
                <span className="flex-1 text-small line-through">
                  {item.title}
                </span>
                <span className="text-caption">→ rolled</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-small font-semibold">Done</h2>
        {done.length === 0 ? (
          <p className="text-small text-muted-foreground">Nothing done yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {done.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5"
              >
                <Checkbox
                  aria-label={item.title}
                  checked
                  onCheckedChange={(checked) =>
                    handleToggle(item, checked === true)
                  }
                  className="size-5"
                />
                <span className="flex-1 text-small text-muted-foreground line-through">
                  {item.title}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove "${item.title}"`}
                  onClick={() => handleRemove(item)}
                >
                  <X aria-hidden className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
