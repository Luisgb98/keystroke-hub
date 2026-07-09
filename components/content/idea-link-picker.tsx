"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  linkIdeaToEvent,
  searchLinkableIdeas,
} from "@/lib/content/link-actions";
import { IDEA_FORMAT_LABEL } from "@/lib/content/idea-format";
import { IDEA_STATUS_LABEL } from "@/lib/content/idea-status";
import type { LinkableIdea } from "@/lib/data/idea-event-links";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface IdeaLinkPickerProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Searchable idea picker for `EventLinkedIdeas`. This project's shadcn setup
 * (Base UI) has no `command`/`popover`/sheet component, so a `Dialog` +
 * filtered `Input` list stands in — same pragmatic choice `EventEditor`
 * documents for itself (see docs/content-links.md).
 */
export function IdeaLinkPicker({
  eventId,
  open,
  onOpenChange,
}: IdeaLinkPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkableIdea[]>([]);
  // Which `eventId:query` pair `results` was fetched for — `null` (or a
  // mismatch against the current pair) means a fetch is in flight, so
  // "loading" is derived rather than a separate setState call in the effect
  // below (avoids react-hooks/set-state-in-effect's cascading-render warning
  // for an unconditional synchronous setState at the top of an effect body).
  const [resultsKey, setResultsKey] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const requestKey = `${eventId}:${query}`;
  const loading = open && resultsKey !== requestKey;

  // Reset search state on close by adjusting state during render (rather
  // than in an effect) — same pattern as EventEditor's `prevOpen` tracking,
  // avoids an extra render pass. See
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
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
    searchLinkableIdeas(eventId, query).then((ideas) => {
      if (cancelled) return;
      setResults(ideas);
      setResultsKey(requestKey);
    });
    return () => {
      cancelled = true;
    };
  }, [open, eventId, query, requestKey]);

  function handleLink(idea: LinkableIdea) {
    setLinkingId(idea.id);
    startTransition(async () => {
      const result = await linkIdeaToEvent(eventId, idea.id);
      setLinkingId(null);
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
            Search your ideas and attach one to this event.
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
              {query ? "No matching ideas." : "No ideas left to link."}
            </p>
          ) : (
            results.map((idea) => (
              <button
                key={idea.id}
                type="button"
                disabled={pending && linkingId === idea.id}
                onClick={() => handleLink(idea)}
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
