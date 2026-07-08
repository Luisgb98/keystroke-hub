import type { Metadata } from "next";
import Link from "next/link";
import { Lightbulb } from "lucide-react";

import { PipelineBoard } from "@/components/content/board/pipeline-board";
import { getIdeasForBoard } from "@/lib/data/ideas";
import { getIdeaIdsWithScripts } from "@/lib/data/scripts";
import type { Idea } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Board",
};

export default async function BoardPage() {
  // Same resilience contract as /content/ideas (see docs/database.md): CI's
  // e2e job has no DATABASE_URL, and this route is linked from primary
  // navigation, so it must render (with an empty board) rather than throw.
  let ideas: Idea[] = [];
  let ideaIdsWithScripts = new Set<string>();
  try {
    [ideas, ideaIdsWithScripts] = await Promise.all([
      getIdeasForBoard(),
      getIdeaIdsWithScripts(),
    ]);
  } catch (error) {
    console.error("Failed to load the board:", error);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-10 sm:py-8">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-heading text-h1 font-semibold">Board</h1>
          <Link
            href="/content/ideas"
            className="flex items-center gap-1.5 text-small font-medium text-track-content-foreground hover:underline"
          >
            <Lightbulb aria-hidden className="size-4" />
            Ideas list
          </Link>
        </div>
        <p className="text-small text-muted-foreground">
          Every idea&apos;s pipeline stage, at a glance.
        </p>
      </div>

      <PipelineBoard ideas={ideas} ideaIdsWithScripts={ideaIdsWithScripts} />
    </div>
  );
}
