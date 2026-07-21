"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

const MEETINGS_PATH = "/projects/meetings";
const SEARCH_DEBOUNCE_MS = 300;

interface MeetingSearchProps {
  value: string;
}

/**
 * URL-driven search for `/projects/meetings` — every change navigates via
 * `router.replace` so a search is shareable and survives a reload, debounced
 * locally before writing to the URL (same pattern as `IdeaFilters`, minus
 * the chip filters — meeting notes only need a single search box, see
 * docs/meetings.md).
 */
export function MeetingSearch({ value }: MeetingSearchProps) {
  const router = useRouter();
  const [q, setQ] = useState(value);

  // Adjusts local state during render (not an effect) when the URL's own
  // `q` changes externally (e.g. browser back) — same pattern as
  // `IdeaFilters`'s `prevValue` handling.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setQ(value);
  }

  useEffect(() => {
    if (q === value) return;
    const timeout = setTimeout(() => {
      router.replace(
        q ? `${MEETINGS_PATH}?q=${encodeURIComponent(q)}` : MEETINGS_PATH
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="relative">
      <Search
        aria-hidden
        className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        placeholder="Search meeting notes by title or notes"
        aria-label="Search meeting notes"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}
