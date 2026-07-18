import type { Metadata } from "next";

import { CommandPaletteProvider } from "@/components/command-palette/command-palette-provider";
import { CaptureDock } from "@/components/inbox/capture-dock";
import { InboxCaptureProvider } from "@/components/inbox/inbox-capture-provider";
import { BottomNav } from "@/components/shell/bottom-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { verifySession } from "@/lib/auth/session";
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
        <div className="flex min-h-full flex-1">
          <Sidebar untriagedCount={untriagedCount} />
          <main className="flex min-h-full min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
          <BottomNav />
        </div>
        <CaptureDock untriagedCount={untriagedCount} />
      </CommandPaletteProvider>
    </InboxCaptureProvider>
  );
}
