import type { Metadata } from "next";
import Link from "next/link";
import { Clapperboard, Columns3, Lightbulb } from "lucide-react";

import { PlaceholderPanel } from "@/components/shell/placeholder-panel";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Content",
};

export default function ContentPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-h1 font-semibold">Content</h1>
        <p className="text-small text-muted-foreground">
          Video ideas, scripts, and your streaming schedule.
        </p>
      </div>

      <Link href="/content/ideas" className="block">
        <Card className="border-track-content-border transition-colors hover:bg-track-content/40">
          <CardContent className="flex items-center gap-3">
            <Lightbulb
              aria-hidden
              className="size-6 shrink-0 text-track-content-foreground"
            />
            <div className="flex flex-col">
              <span className="font-heading text-h3 font-semibold">Ideas</span>
              <span className="text-small text-muted-foreground">
                Capture and organize video and stream ideas
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>

      <Link href="/content/board" className="block">
        <Card className="border-track-content-border transition-colors hover:bg-track-content/40">
          <CardContent className="flex items-center gap-3">
            <Columns3
              aria-hidden
              className="size-6 shrink-0 text-track-content-foreground"
            />
            <div className="flex flex-col">
              <span className="font-heading text-h3 font-semibold">Board</span>
              <span className="text-small text-muted-foreground">
                Track every idea through the pipeline, stage by stage
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>

      <PlaceholderPanel icon={Clapperboard} />
    </div>
  );
}
