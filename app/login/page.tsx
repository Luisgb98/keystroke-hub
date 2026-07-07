import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — Keystroke Hub",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-2 text-center">
        <p className="flex items-baseline gap-2">
          <span className="font-heading text-display font-semibold">
            Keystroke
          </span>
          <span className="font-mono text-h3 text-primary">Hub</span>
        </p>
        <p className="text-small text-muted-foreground">
          Work and content, side by side. One seat, one key.
        </p>
      </header>

      <LoginForm from={typeof from === "string" ? from : undefined} />

      <p className="font-mono text-caption text-muted-foreground">
        private build · authorized keystrokes only
      </p>
    </div>
  );
}
