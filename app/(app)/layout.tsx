import type { Metadata } from "next";

import { BottomNav } from "@/components/shell/bottom-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { verifySession } from "@/lib/auth/session";

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

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar />
      <main className="flex min-h-full min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
