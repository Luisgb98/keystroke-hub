import { Clapperboard, SearchX } from "lucide-react";

interface IdeaEmptyStateProps {
  /** True when filters/search produced zero results, vs. no ideas existing at all. */
  hasActiveFilters: boolean;
}

export function IdeaEmptyState({ hasActiveFilters }: IdeaEmptyStateProps) {
  if (hasActiveFilters) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <SearchX aria-hidden className="size-8 text-muted-foreground" />
        <p className="font-heading text-h3 font-semibold">No matching ideas</p>
        <p className="max-w-sm text-small text-muted-foreground">
          Try a different search or clear a filter.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-track-content-border bg-track-content/40 py-16 text-center">
      <Clapperboard
        aria-hidden
        className="size-8 text-track-content-foreground"
      />
      <p className="font-heading text-h3 font-semibold">
        Capture your first idea
      </p>
      <p className="max-w-sm text-small text-muted-foreground">
        Every video and stream idea starts here. Tap &ldquo;New idea&rdquo; the
        moment one hits.
      </p>
    </div>
  );
}
