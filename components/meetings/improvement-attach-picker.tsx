"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  linkImprovementToMeetingNote,
  searchLinkableImprovements,
} from "@/lib/meetings/actions";
import { IMPROVEMENT_STATUS_LABEL } from "@/lib/improvements/improvement-status";
import type { LinkableImprovement } from "@/lib/data/meeting-notes";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ImprovementAttachPickerProps {
  meetingNoteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Searchable improvement picker for `MeetingNoteImprovementsSection` —
 * excludes improvements already linked to this meeting note (see
 * `searchLinkableImprovements`), same pragmatic `Dialog` + filtered `Input`
 * list as `IdeaAttachPicker`.
 */
export function ImprovementAttachPicker({
  meetingNoteId,
  open,
  onOpenChange,
}: ImprovementAttachPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkableImprovement[]>([]);
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
    searchLinkableImprovements(meetingNoteId, query).then((improvements) => {
      if (cancelled) return;
      setResults(improvements);
      setResultsKey(query);
    });
    return () => {
      cancelled = true;
    };
  }, [open, query, meetingNoteId]);

  function handleAttach(improvement: LinkableImprovement) {
    setAttachingId(improvement.id);
    startTransition(async () => {
      const result = await linkImprovementToMeetingNote(
        meetingNoteId,
        improvement.id
      );
      setAttachingId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setResults((prev) => prev.filter((r) => r.id !== improvement.id));
      toast.success(`"${improvement.title}" linked`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link an improvement</DialogTitle>
          <DialogDescription>
            Search the improvements backlog and attach one to this meeting note.
          </DialogDescription>
        </DialogHeader>

        <Input
          autoFocus
          placeholder="Search improvements…"
          aria-label="Search improvements"
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
              {query
                ? "No matching improvements."
                : "No more improvements to link."}
            </p>
          ) : (
            results.map((improvement) => (
              <button
                key={improvement.id}
                type="button"
                disabled={pending && attachingId === improvement.id}
                onClick={() => handleAttach(improvement)}
                className="flex flex-col items-start gap-1 rounded-lg px-2 py-2 text-left hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="text-small font-medium">
                  {improvement.title}
                </span>
                <Badge variant="secondary">
                  {IMPROVEMENT_STATUS_LABEL[improvement.status]}
                </Badge>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
