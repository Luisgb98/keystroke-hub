import type { Metadata } from "next";

import { IdeaCapture } from "@/components/content/idea-capture";
import { IdeaCard } from "@/components/content/idea-card";
import { IdeaEmptyState } from "@/components/content/idea-empty-state";
import { IdeaFilters } from "@/components/content/idea-filters";
import { isIdeaFormat } from "@/lib/content/idea-format";
import { isIdeaStatus } from "@/lib/content/idea-status";
import {
  getDistinctIdeaTags,
  getIdeas,
  type IdeaFilters as IdeaFilterInput,
} from "@/lib/data/ideas";
import type { Idea } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Ideas",
};

interface IdeasPageProps {
  searchParams: Promise<{
    q?: string;
    format?: string;
    status?: string;
    tag?: string;
  }>;
}

export default async function IdeasPage({ searchParams }: IdeasPageProps) {
  const params = await searchParams;
  const filters: IdeaFilterInput = {
    q: params.q?.trim() || undefined,
    format: isIdeaFormat(params.format) ? params.format : undefined,
    status: isIdeaStatus(params.status) ? params.status : undefined,
    tag: params.tag?.trim() || undefined,
  };

  // The ideas list should render even if the database is unreachable — same
  // resilience contract as /calendar (see docs/database.md): CI's e2e job
  // has no DATABASE_URL, and this route is linked from primary navigation.
  let ideas: Idea[] = [];
  let availableTags: string[] = [];
  try {
    [ideas, availableTags] = await Promise.all([
      getIdeas(filters),
      getDistinctIdeaTags(),
    ]);
  } catch (error) {
    console.error("Failed to load ideas:", error);
  }

  const hasActiveFilters = Boolean(
    filters.q || filters.format || filters.status || filters.tag
  );

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-10 sm:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-h1 font-semibold">Ideas</h1>
        <p className="text-small text-muted-foreground">
          Video and stream ideas, captured the moment they hit.
        </p>
      </div>

      <IdeaFilters value={params} availableTags={availableTags} />

      {ideas.length === 0 ? (
        <IdeaEmptyState hasActiveFilters={hasActiveFilters} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}

      <IdeaCapture />
    </div>
  );
}
