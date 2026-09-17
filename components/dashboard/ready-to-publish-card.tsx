import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Upload } from "lucide-react";

import { getIdeasReadyToPublish } from "@/lib/data/ideas";
import type { Idea } from "@/lib/db/schema";
import { IdeaCopyActions } from "@/components/content/idea-copy-actions";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Self-fetching ready-to-publish block for the dashboard (#128): every idea
 * in the `edited` stage with its four copy blocks, so publishing day is
 * open → copy → paste rather than Content → Ideas → filter → find. Same
 * DB-failure resilience contract as `UpcomingAgenda`: a query failure
 * renders the empty state rather than breaking the host page (CI's e2e job
 * has no DATABASE_URL, see docs/database.md).
 */
export async function ReadyToPublishCard() {
  let ideas: Idea[] = [];
  try {
    ideas = await getIdeasReadyToPublish();
  } catch (error) {
    console.error("Failed to load ideas ready to publish:", error);
  }

  return <ReadyToPublishView ideas={ideas} />;
}

type ReadyIdea = Pick<
  Idea,
  "id" | "title" | "description" | "tags" | "stageEnteredAt"
>;

interface ReadyToPublishViewProps {
  ideas: ReadyIdea[];
}

/** The rendering half, split out so it's unit-testable without a database. */
export function ReadyToPublishView({ ideas }: ReadyToPublishViewProps) {
  return (
    <Card data-slot="ready-to-publish" className="border-track-content-border">
      <CardHeader>
        <CardTitle>Ready to publish</CardTitle>
      </CardHeader>
      <CardContent>
        {ideas.length === 0 ? (
          <p className="text-small text-muted-foreground">
            Nothing is edited and waiting. Cut something and it lands here.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {ideas.map((idea) => (
              <li
                key={idea.id}
                data-slot="ready-to-publish-item"
                className="flex flex-col gap-2"
              >
                <div className="flex flex-col gap-0.5">
                  {/* The title gets the full width and two lines: it's what
                      you're about to paste somewhere, so it has to be
                      readable — the age is context, not the point. */}
                  <Link
                    href={`/content/ideas/${idea.id}`}
                    className="flex items-start gap-1.5 font-medium hover:underline"
                  >
                    <Upload
                      aria-hidden
                      className="mt-1 size-3.5 shrink-0 text-track-content-foreground"
                    />
                    <span className="line-clamp-2">{idea.title}</span>
                  </Link>
                  <span
                    className="pl-5 font-mono text-caption text-muted-foreground"
                    title={idea.stageEnteredAt.toLocaleString()}
                  >
                    Edited{" "}
                    {formatDistanceToNow(idea.stageEnteredAt, {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <IdeaCopyActions idea={idea} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter>
        <Link
          href="/content/ideas?status=edited"
          className="text-small font-medium text-primary hover:underline"
        >
          Open in Ideas →
        </Link>
      </CardFooter>
    </Card>
  );
}
