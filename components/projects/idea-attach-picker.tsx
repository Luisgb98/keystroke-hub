"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { linkIdeaToProject, searchLinkableIdeas } from "@/lib/projects/actions";
import { IDEA_FORMAT_LABEL } from "@/lib/content/idea-format";
import { IDEA_STATUS_LABEL } from "@/lib/content/idea-status";
import type { LinkableIdea } from "@/lib/data/projects";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface IdeaAttachPickerProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Searchable picker for `ProjectLinkedIdeas` — only unassigned ideas show up
 * (see `searchLinkableIdeas` in `lib/data/projects.ts`), same pragmatic
 * `Dialog` + filtered `Input` list as `EventAttachPicker`/`IdeaLinkPicker`.
 */
export function IdeaAttachPicker({
  projectId,
  open,
  onOpenChange,
}: IdeaAttachPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkableIdea[]>([]);
  const [resultsKey, setResultsKey] = useState<string | null>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loading = open && resultsKey !== query;

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setQuery("");
      setResults([]);
      setResultsKey(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    searchLinkableIdeas(query).then((ideas) => {
      if (cancelled) return;
      setResults(ideas);
      setResultsKey(query);
    });
    return () => {
      cancelled = true;
    };
  }, [open, query]);

  function handleAttach(idea: LinkableIdea) {
    setAttachingId(idea.id);
    startTransition(async () => {
      const result = await linkIdeaToProject(projectId, idea.id);
      setAttachingId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setResults((prev) => prev.filter((r) => r.id !== idea.id));
      toast.success(`"${idea.title}" linked`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link an idea</DialogTitle>
          <DialogDescription>
            Search unassigned ideas and attach one to this project.
          </DialogDescription>
        </DialogHeader>

        <Input
          autoFocus
          placeholder="Search ideas…"
          aria-label="Search ideas"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-small text-muted-foreground">
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-small text-muted-foreground">
              {query ? "No matching ideas." : "No unassigned ideas left."}
            </p>
          ) : (
            results.map((idea) => (
              <button
                key={idea.id}
                type="button"
                disabled={pending && attachingId === idea.id}
                onClick={() => handleAttach(idea)}
                className="flex flex-col items-start gap-1 rounded-lg px-2 py-2 text-left hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="text-small font-medium">{idea.title}</span>
                <span className="flex gap-1.5">
                  <Badge variant="secondary">
                    {IDEA_FORMAT_LABEL[idea.format]}
                  </Badge>
                  <Badge variant="outline">
                    {IDEA_STATUS_LABEL[idea.status]}
                  </Badge>
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
