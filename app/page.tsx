import Link from "next/link";
import { Briefcase, Clapperboard } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 sm:px-10">
        <span className="font-heading text-h3 font-semibold">
          Keystroke Hub
        </span>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-8 px-6 py-16 sm:px-10">
        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-display font-semibold text-balance">
            One hub, two worlds.
          </h1>
          <p className="max-w-prose text-body text-muted-foreground">
            Work life and content creation, side by side — never mixed. This is
            the foundation build; the real home screen lands with the next
            feature.
          </p>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Card className="border-track-work bg-track-work text-track-work-foreground">
            <CardHeader>
              <Briefcase aria-hidden className="size-5" />
              <CardTitle className="text-track-work-foreground">
                Work track
              </CardTitle>
              <CardDescription className="text-track-work-foreground/80">
                Tasks, logs, meetings, projects.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-track-content bg-track-content text-track-content-foreground">
            <CardHeader>
              <Clapperboard aria-hidden className="size-5" />
              <CardTitle className="text-track-content-foreground">
                Content track
              </CardTitle>
              <CardDescription className="text-track-content-foreground/80">
                Video ideas, scripts, streaming schedule.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Button render={<Link href="/styleguide" />}>
          View the styleguide
        </Button>
      </main>
    </div>
  );
}
