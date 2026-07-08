"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { IDEA_FORMATS, IDEA_FORMAT_LABEL } from "@/lib/content/idea-format";
import { IDEA_STATUSES, IDEA_STATUS_LABEL } from "@/lib/content/idea-status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const IDEAS_PATH = "/content/ideas";
const SEARCH_DEBOUNCE_MS = 300;

export interface IdeaFiltersValue {
  q?: string;
  format?: string;
  status?: string;
  tag?: string;
}

interface IdeaFiltersProps {
  value: IdeaFiltersValue;
  availableTags: string[];
}

function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-small font-medium whitespace-nowrap transition-all",
        selected
          ? "border-track-content-border bg-track-content text-track-content-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
    </button>
  );
}

/**
 * URL-driven search + filters (see docs/content-ideas.md): every change
 * navigates via `router.replace`, so filtered views are shareable and
 * survive a reload. Search debounces locally before writing to the URL;
 * chip toggles (format/status/tag) navigate immediately.
 */
export function IdeaFilters({ value, availableTags }: IdeaFiltersProps) {
  const router = useRouter();
  // Local, optimistically-updated copy of every filter — not just `q` — so
  // rapid successive clicks (e.g. a format chip immediately followed by a
  // tag chip) compose correctly. Basing `toggle` off the `value` prop
  // instead would lose the first change: that prop only updates once the
  // server round-trips the new searchParams, which a second click can beat.
  const [filters, setFilters] = useState<IdeaFiltersValue>(value);
  const [q, setQ] = useState(value.q ?? "");

  // Adjusting state during render (rather than in an effect) when the URL's
  // own filters change externally (e.g. "Reset filters", browser back) —
  // avoids the "setState in effect" cascading-render lint rule, same
  // pattern as EventEditor's `prevOpen` handling in
  // components/calendar/event-editor.tsx. Doesn't fire on every keystroke:
  // those update `q` directly, not `value.q`.
  const [prevValue, setPrevValue] = useState(value);
  if (
    value.q !== prevValue.q ||
    value.format !== prevValue.format ||
    value.status !== prevValue.status ||
    value.tag !== prevValue.tag
  ) {
    setPrevValue(value);
    setFilters(value);
    setQ(value.q ?? "");
  }

  useEffect(() => {
    if (q === (filters.q ?? "")) return;
    const timeout = setTimeout(
      () => navigate({ ...filters, q: q || undefined }),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function navigate(next: IdeaFiltersValue) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.format) params.set("format", next.format);
    if (next.status) params.set("status", next.status);
    if (next.tag) params.set("tag", next.tag);
    const qs = params.toString();
    router.replace(qs ? `${IDEAS_PATH}?${qs}` : IDEAS_PATH);
  }

  function toggle(key: "format" | "status" | "tag", option: string) {
    navigate({
      ...filters,
      [key]: filters[key] === option ? undefined : option,
    });
  }

  function reset() {
    setFilters({});
    setQ("");
    router.replace(IDEAS_PATH);
  }

  const hasActiveFilters = Boolean(
    filters.q || filters.format || filters.status || filters.tag
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden
          className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          placeholder="Search ideas by title"
          aria-label="Search ideas"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8"
        />
      </div>

      <div
        role="group"
        aria-label="Filter by format"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {IDEA_FORMATS.map((format) => (
          <FilterChip
            key={format}
            label={IDEA_FORMAT_LABEL[format]}
            selected={filters.format === format}
            onClick={() => toggle("format", format)}
          />
        ))}
      </div>

      <div
        role="group"
        aria-label="Filter by status"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {IDEA_STATUSES.map((status) => (
          <FilterChip
            key={status}
            label={IDEA_STATUS_LABEL[status]}
            selected={filters.status === status}
            onClick={() => toggle("status", status)}
          />
        ))}
      </div>

      {availableTags.length > 0 ? (
        <div
          role="group"
          aria-label="Filter by tag"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {availableTags.map((tag) => (
            <FilterChip
              key={tag}
              label={`#${tag}`}
              selected={filters.tag === tag}
              onClick={() => toggle("tag", tag)}
            />
          ))}
        </div>
      ) : null}

      {hasActiveFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={reset}
        >
          <X aria-hidden className="size-3.5" />
          Reset filters
        </Button>
      ) : null}
    </div>
  );
}
