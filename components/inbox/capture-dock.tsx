"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

import { useInboxCapture } from "./inbox-capture-provider";

interface CaptureDockProps {
  untriagedCount: number;
}

/**
 * Routes that render their own bottom-right FAB (idea/stream creation). On
 * those, the global capture dock lifts a row higher so the two never overlap —
 * everywhere else it sits in the natural thumb zone just above the bottom nav.
 */
const ROUTES_WITH_OWN_FAB = ["/content/ideas", "/content/streams"];

/**
 * The app's signature affordance: a floating capture button in the bottom-right
 * thumb zone on every screen, with the inbox (and its untriaged count) sitting
 * just above it. Capture is two taps from anywhere — tap the button, type,
 * save. The container is pointer-events-transparent (only the two controls
 * catch clicks) so it never blocks content beneath it (see docs/inbox.md).
 */
export function CaptureDock({ untriagedCount }: CaptureDockProps) {
  const { openCapture } = useInboxCapture();
  const pathname = usePathname();
  const hasEntries = untriagedCount > 0;
  const lifted = ROUTES_WITH_OWN_FAB.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-4 z-30 flex flex-col items-end gap-2 md:right-6",
        lifted
          ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom)+3.75rem)] md:bottom-20"
          : "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6"
      )}
    >
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

      <Button
        type="button"
        size="icon-lg"
        aria-label="Capture a thought"
        className="pointer-events-auto size-12 rounded-full shadow-lg [&_svg]:size-6"
        onClick={openCapture}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
