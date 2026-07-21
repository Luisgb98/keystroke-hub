"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface AttachPickerProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dialog copy. */
  title: string;
  description: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  /**
   * Stable key for the search scope (typically the parent id). Combined with
   * the query into the request key so results refetch — and the loading state
   * stays correct — when the scope changes while the picker is open.
   */
  scopeKey?: string;
  search: (query: string) => Promise<T[]>;
  attach: (item: T) => Promise<{ error?: string }>;
  getKey: (item: T) => string;
  getTitle: (item: T) => string;
  /** Optional per-row secondary line (a date, badges, …). */
  renderSubLabel?: (item: T) => ReactNode;
  successMessage: (item: T) => string;
  /** Empty-state copy, with vs. without an active query. */
  emptyWithQuery: string;
  emptyWithoutQuery: string;
}

/**
 * The single searchable "pick one and attach it" dialog behind every
 * attach/link picker in the app (streams, meeting notes, projects, event
 * links). This project's shadcn setup (Base UI) ships no command/popover, so
 * a `Dialog` + filtered `Input` list stands in — the pragmatic pattern the
 * five original pickers each re-implemented before this consolidation (issue
 * #67, finding D10). Callers adapt it to their entity via the props above.
 */
export function AttachPicker<T>({
  open,
  onOpenChange,
  title,
  description,
  searchPlaceholder,
  searchAriaLabel,
  scopeKey = "",
  search,
  attach,
  getKey,
  getTitle,
  renderSubLabel,
  successMessage,
  emptyWithQuery,
  emptyWithoutQuery,
}: AttachPickerProps<T>) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  // Which `scopeKey:query` pair `results` was fetched for — `null` (or a
  // mismatch against the current pair) means a fetch is in flight, so
  // "loading" is derived rather than tracked as a separate setState in the
  // effect below (avoids the cascading-render warning of an unconditional
  // synchronous setState at the top of an effect body).
  const [resultsKey, setResultsKey] = useState<string | null>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Callers pass inline `search` closures (fresh identity each render).
  // Holding the latest in a ref keeps the fetch effect keyed only on the
  // inputs that should trigger a refetch (open/query/scope) — otherwise a new
  // closure every render would re-run it in a loop.
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  });

  const requestKey = `${scopeKey}:${query}`;
  const loading = open && resultsKey !== requestKey;

  // Reset search state on close by adjusting state during render rather than
  // in an effect — avoids an extra render pass. See
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
    searchRef.current(query).then((items) => {
      if (cancelled) return;
      setResults(items);
      setResultsKey(`${scopeKey}:${query}`);
    });
    return () => {
      cancelled = true;
    };
  }, [open, query, scopeKey]);

  function handleAttach(item: T) {
    setAttachingId(getKey(item));
    startTransition(async () => {
      const result = await attach(item);
      setAttachingId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage(item));
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Input
          autoFocus
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
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
              {query ? emptyWithQuery : emptyWithoutQuery}
            </p>
          ) : (
            results.map((item) => {
              const key = getKey(item);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={pending && attachingId === key}
                  onClick={() => handleAttach(item)}
                  className="flex flex-col items-start gap-1 rounded-lg px-2 py-2 text-left hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="text-small font-medium">
                    {getTitle(item)}
                  </span>
                  {renderSubLabel?.(item)}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
