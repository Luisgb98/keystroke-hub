import type { Metadata } from "next";

import { CommandPaletteProvider } from "@/components/command-palette/command-palette-provider";
import { InboxCaptureProvider } from "@/components/inbox/inbox-capture-provider";
import { BottomNav } from "@/components/shell/bottom-nav";
import { BOTTOM_NAV_SPACER_CLASSES } from "@/components/shell/bottom-nav-styles";
import { Sidebar } from "@/components/shell/sidebar";
import { verifySession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { getUntriagedCount } from "@/lib/inbox/queries";

export const metadata: Metadata = {
  title: {
    template: "%s — Keystroke Hub",
    default: "Keystroke Hub",
  },
};

export default async function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // DAL check — the proxy gate is only optimistic (see docs/auth.md).
  await verifySession();

  // Resilient to a DB outage — the count degrades to 0 rather than breaking
  // the whole shell (same contract as the dashboard blocks, see docs/inbox.md).
  let untriagedCount = 0;
  try {
    untriagedCount = await getUntriagedCount();
  } catch (error) {
    console.error("Failed to load the inbox count:", error);
  }

  return (
    <InboxCaptureProvider>
      <CommandPaletteProvider>
        {/* The shell is viewport-locked so the sidebar can never stretch or
            scroll away: `<main>` is the app's only vertical scrollport
            (issue #87, see docs/calendar.md#scroll-contract). Deliberately
            scoped here rather than on `body` — `/login` and `/styleguide`
            live outside this layout and still rely on body scroll. */}
        <div className="flex h-dvh overflow-hidden">
          <Sidebar untriagedCount={untriagedCount} />
          {/* The bottom padding comes from the bar's own style module so the
              two can't drift apart and clip the last row of a page (#114). */}
          <main
            className={cn(
              // `overscroll-y-contain`: the shell is viewport-locked, so a
              // rubber-band overscroll at the top of this scrollport would
              // hand the gesture to the browser and fire pull-to-refresh over
              // a page that never scrolls (#114).
              "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain",
              BOTTOM_NAV_SPACER_CLASSES
            )}
          >
            {children}
          </main>
          <BottomNav untriagedCount={untriagedCount} />
        </div>
      </CommandPaletteProvider>
    </InboxCaptureProvider>
  );
}
