"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle } from "lucide-react";

import {
  TRACK_ICON,
  TRACK_LABEL,
  TRACK_SURFACE_CLASSES,
} from "@/components/calendar/track-styles";
import { requestOpenCapture } from "@/components/inbox/inbox-capture-provider";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SearchResultGroups } from "@/lib/data/search";
import { getRecentPaletteItems, searchAll } from "@/lib/search/actions";
import { allSearchNavItems, filterNavItems } from "@/lib/search/navigation";
import type { SearchResult, SearchResultType } from "@/lib/search/types";

const SEARCH_DEBOUNCE_MS = 200;

const RESULT_GROUP_LABEL: Record<SearchResultType, string> = {
  idea: "Ideas",
  script: "Scripts",
  "daily-log": "Daily logs",
  "meeting-note": "Meeting notes",
  project: "Projects",
  improvement: "Improvements",
};

const RESULT_TYPE_LABEL: Record<SearchResultType, string> = {
  idea: "Idea",
  script: "Script",
  "daily-log": "Daily log",
  "meeting-note": "Meeting note",
  project: "Project",
  improvement: "Improvement",
};

const RESULT_GROUP_ORDER: (keyof SearchResultGroups)[] = [
  "ideas",
  "scripts",
  "dailyLogs",
  "meetingNotes",
  "projects",
  "improvements",
];

function itemValue(result: SearchResult): string {
  return `${result.type}-${result.id}`;
}

function ResultRow({ result }: { result: SearchResult }) {
  const Icon = TRACK_ICON[result.world];
  return (
    <>
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md border",
          TRACK_SURFACE_CLASSES[result.world]
        )}
      >
        <Icon aria-hidden className="size-3.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{result.title}</span>
        {result.snippet && (
          <span className="truncate text-caption text-muted-foreground">
            {result.snippet}
          </span>
        )}
      </span>
      <span className="ml-auto shrink-0 text-caption text-muted-foreground">
        {TRACK_LABEL[result.world]} · {RESULT_TYPE_LABEL[result.type]}
      </span>
    </>
  );
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The dialog: Recent + Navigate before typing, per-entity result groups once
 * a query is entered. `Command` runs with `shouldFilter={false}` because
 * results are already filtered server-side (search) or by us (navigation) —
 * letting cmdk re-filter would silently drop matches (see
 * docs/command-palette.md).
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<SearchResult[]>([]);
  const [groups, setGroups] = useState<SearchResultGroups | null>(null);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  // Resets transient state on close during render (not an effect) — same
  // "adjust state when a prop changes" idiom as `MeetingSearch`'s
  // `prevValue` handling, avoiding a setState-in-effect render cascade.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setQuery("");
      setGroups(null);
      setLoading(false);
    }
  }

  // Same render-time pattern: clearing results the instant the query goes
  // blank is a derived reset, not new async work.
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    if (!query.trim()) {
      setGroups(null);
      setLoading(false);
    }
  }

  // Recents are fetched once per open, not per keystroke.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getRecentPaletteItems().then((items) => {
      if (!cancelled) setRecents(items);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const requestId = ++requestIdRef.current;
    const timeout = setTimeout(() => {
      setLoading(true);
      searchAll(trimmed).then((result) => {
        // Stale-response guard: a slower, earlier request can resolve after
        // a faster, later one — only the most recently *fired* request may
        // ever update state (server actions have no abort signal).
        if (requestIdRef.current !== requestId) return;
        setGroups(result);
        setLoading(false);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  function navigateTo(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  // Palette actions do something rather than navigate — capture opens the
  // global capture dialog via the decoupled window event (see docs/inbox.md).
  const paletteActions = useMemo(
    () => [
      {
        id: "capture",
        label: "Capture a thought",
        icon: PlusCircle,
        run: () => {
          onOpenChange(false);
          requestOpenCapture();
        },
      },
    ],
    [onOpenChange]
  );

  const trimmed = query.trim();
  const matchingActions = paletteActions.filter((action) =>
    action.label.toLowerCase().includes(trimmed.toLowerCase())
  );
  const matchingNavItems = filterNavItems(allSearchNavItems, trimmed);
  const entityGroups = groups
    ? RESULT_GROUP_ORDER.map((key) => ({ key, results: groups[key] })).filter(
        (group) => group.results.length > 0
      )
    : [];
  const hasAnyMatch =
    matchingActions.length > 0 ||
    matchingNavItems.length > 0 ||
    entityGroups.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
    >
      <Command shouldFilter={false} loop>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search or jump to..."
          aria-label="Search"
        />
        <CommandList>
          {!trimmed && recents.length > 0 && (
            <CommandGroup heading="Recent">
              {recents.map((result) => (
                <CommandItem
                  key={itemValue(result)}
                  value={itemValue(result)}
                  onSelect={() => navigateTo(result.href)}
                >
                  <ResultRow result={result} />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {matchingActions.length > 0 && (
            <CommandGroup heading="Actions">
              {matchingActions.map((action) => (
                <CommandItem
                  key={action.id}
                  value={`action-${action.id}`}
                  onSelect={action.run}
                >
                  <action.icon aria-hidden className="size-4 shrink-0" />
                  <span>{action.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {matchingNavItems.length > 0 && (
            <CommandGroup heading="Navigate">
              {matchingNavItems.map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.href}
                  onSelect={() => navigateTo(item.href)}
                >
                  <item.icon aria-hidden className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {trimmed && loading && !groups && (
            <div className="flex flex-col gap-2 p-2" aria-hidden>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          )}

          {trimmed &&
            entityGroups.map(({ key, results }) => (
              <CommandGroup
                key={key}
                heading={RESULT_GROUP_LABEL[results[0].type]}
              >
                {results.map((result) => (
                  <CommandItem
                    key={itemValue(result)}
                    value={itemValue(result)}
                    onSelect={() => navigateTo(result.href)}
                  >
                    <ResultRow result={result} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}

          {trimmed && !loading && !hasAnyMatch && (
            <CommandEmpty>No results for &quot;{trimmed}&quot;.</CommandEmpty>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
