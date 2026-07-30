"use client";

import Link from "next/link";
import { Inbox, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { useDockAction } from "@/components/shell/dock-action-provider";

import { useInboxCapture } from "./inbox-capture-provider";

interface CaptureDockProps {
  untriagedCount: number;
}

/**
 * The app's signature affordance: a floating dock in the bottom-right thumb
 * zone on every screen, with the inbox (and its untriaged count) sitting just
 * above a single primary action button. That primary button is the global
 * quick-capture "+" by default; on screens that register their own action
 * (ideas, streams) it becomes that page's action instead — the two are swapped,
 * never stacked, so there's always exactly one obvious floating action and the
 * corner never clutters (Issue #74). The container is pointer-events-transparent
 * (only the controls catch clicks) so it never blocks content beneath it (see
 * docs/inbox.md).
 */
export function CaptureDock({ untriagedCount }: CaptureDockProps) {
  const { openCapture } = useInboxCapture();
  const pageAction = useDockAction();
  const hasEntries = untriagedCount > 0;
  const ActionIcon = pageAction?.icon;

  return (
    <div className="pointer-events-none fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex flex-col items-end gap-2 md:right-6 md:bottom-6">
      <Link
        href="/inbox"
        aria-label={`Inbox${hasEntries ? `, ${untriagedCount} to triage` : ", empty"}`}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "pointer-events-auto rounded-full shadow-sm"
        )}
      >
        <Inbox aria-hidden />
        <span>Inbox</span>
        {hasEntries ? (
          <span
            data-slot="inbox-count"
            className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-caption font-semibold text-primary-foreground tabular-nums"
          >
            {untriagedCount}
          </span>
        ) : null}
      </Link>

      {pageAction && ActionIcon ? (
        <Button
          type="button"
          className="pointer-events-auto shadow-lg"
          onClick={pageAction.onSelect}
        >
          <ActionIcon aria-hidden />
          {pageAction.label}
        </Button>
      ) : (
        <Button
          type="button"
          size="icon-lg"
          aria-label="Capture a thought"
          className="pointer-events-auto size-12 rounded-full shadow-lg [&_svg]:size-6"
          onClick={openCapture}
        >
          <Plus aria-hidden />
        </Button>
      )}
    </div>
  );
}
