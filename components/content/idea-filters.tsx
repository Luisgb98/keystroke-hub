"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

import {
  IDEA_FORMATS,
  IDEA_FORMAT_LABEL,
  isIdeaFormat,
} from "@/lib/content/idea-format";
import {
  IDEA_STATUSES,
  IDEA_STATUS_LABEL,
  isIdeaStatus,
} from "@/lib/content/idea-status";
import type { GameOption } from "@/lib/data/games";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const IDEAS_PATH = "/content/ideas";
const SEARCH_DEBOUNCE_MS = 300;

export interface IdeaFiltersValue {
  q?: string;
  format?: string;
  status?: string;
  tag?: string;
  /** A game's id — composes with every filter above (#105). */
  game?: string;
}

interface IdeaFiltersProps {
  value: IdeaFiltersValue;
  availableTags: string[];
  /** The whole library — one chip per game, same shape as the tag row. */
  availableGames?: GameOption[];
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
        // `min-h-11` on a phone: these are the page's main way to narrow a long
        // idea list, and a 31px pill in a horizontally-scrolling row is a
        // miss waiting to happen (#114).
        "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 py-1 text-small font-medium whitespace-nowrap transition-all md:min-h-0",
        selected
          ? "border-track-content-border bg-track-content text-track-content-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
    </button>
  );
}

type FilterKey = "format" | "status" | "tag" | "game";

interface FilterGroupsProps {
  filters: IdeaFiltersValue;
  availableTags: string[];
  availableGames: GameOption[];
  onToggle: (key: FilterKey, option: string) => void;
  /**
   * Caption each group. Inline, the four rows sit right under the search box
   * and read as one bar; in the sheet the game and tag groups can run to
   * dozens of chips, and a row needs a name to be scanned past.
   */
  labelled?: boolean;
  /**
   * Show every tag rather than the first `INLINE_TAG_LIMIT`. The sheet always
   * shows them all (it scrolls); inline, a library's worth of hashtags would
   * push the first idea below the fold, so the row starts collapsed.
   */
  allTags?: boolean;
  onShowAllTags?: (show: boolean) => void;
}

/** How many tag chips the inline row shows before "Show all" — two rows or so at `md`. */
const INLINE_TAG_LIMIT = 12;

/**
 * The tags the inline row shows while collapsed: the first `limit`, plus the
 * active one if it sorted past them — a filter you can see applied but not
 * find in the row would look like a bug.
 */
export function visibleTags(
  tags: string[],
  active: string | undefined,
  limit = INLINE_TAG_LIMIT
): string[] {
  const head = tags.slice(0, limit);
  if (active && tags.includes(active) && !head.includes(active)) {
    head.push(active);
  }
  return head;
}

function FilterGroup({
  label,
  labelled,
  children,
}: {
  label: string;
  labelled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {labelled ? (
        <span
          aria-hidden
          className="text-caption font-medium tracking-wide text-muted-foreground uppercase"
        >
          {label}
        </span>
      ) : null}
      <div
        role="group"
        aria-label={`Filter by ${label.toLowerCase()}`}
        className="flex flex-wrap gap-2"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The four chip groups — format, status, game, tag — as wrapping rows. Rendered
 * twice by `IdeaFilters`: inline from `md` up, and inside the bottom sheet on a
 * phone. Only one copy is ever in the DOM at a time (the inline one is
 * `display: none` below `md`, the sheet unmounts when closed), so the
 * `aria-label`s stay unique for anyone querying by role.
 */
function FilterGroups({
  filters,
  availableTags,
  availableGames,
  onToggle,
  labelled = false,
  allTags = false,
  onShowAllTags,
}: FilterGroupsProps) {
  const shownTags = allTags
    ? availableTags
    : visibleTags(availableTags, filters.tag);
  const hiddenTagCount = availableTags.length - shownTags.length;
  return (
    <>
      <FilterGroup label="Format" labelled={labelled}>
        {IDEA_FORMATS.map((format) => (
          <FilterChip
            key={format}
            label={IDEA_FORMAT_LABEL[format]}
            selected={filters.format === format}
            onClick={() => onToggle("format", format)}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Status" labelled={labelled}>
        {IDEA_STATUSES.map((status) => (
          <FilterChip
            key={status}
            label={IDEA_STATUS_LABEL[status]}
            selected={filters.status === status}
            onClick={() => onToggle("status", status)}
          />
        ))}
      </FilterGroup>

      {availableGames.length > 0 ? (
        <FilterGroup label="Game" labelled={labelled}>
          {availableGames.map((game) => (
            <FilterChip
              key={game.id}
              label={game.name}
              selected={filters.game === game.id}
              onClick={() => onToggle("game", game.id)}
            />
          ))}
        </FilterGroup>
      ) : null}

      {availableTags.length > 0 ? (
        <FilterGroup label="Tag" labelled={labelled}>
          {shownTags.map((tag) => (
            <FilterChip
              key={tag}
              label={`#${tag}`}
              selected={filters.tag === tag}
              onClick={() => onToggle("tag", tag)}
            />
          ))}
          {onShowAllTags && (hiddenTagCount > 0 || allTags) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => onShowAllTags(!allTags)}
            >
              {allTags
                ? "Show fewer tags"
                : `Show all ${availableTags.length} tags`}
            </Button>
          ) : null}
        </FilterGroup>
      ) : null}
    </>
  );
}

/**
 * One active filter, shown under the search box on a phone so the current
 * narrowing is visible — and droppable — without opening the sheet.
 */
function ActiveFilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Remove filter: ${label}`}
      onClick={onRemove}
      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-track-content-border bg-track-content px-3 py-1 text-small font-medium whitespace-nowrap text-track-content-foreground transition-all"
    >
      {label}
      <X aria-hidden className="size-3.5" />
    </button>
  );
}

/**
 * URL-driven search + filters (see docs/content-ideas.md): every change
 * navigates via `router.replace`, so filtered views are shareable and
 * survive a reload. Search debounces locally before writing to the URL;
 * chip toggles (format/status/tag/game) navigate immediately.
 *
 * On a phone the chip groups live in a bottom sheet behind one "Filters"
 * button, with the active ones echoed as removable chips under the search box
 * (#122). Four horizontally-scrolling rows — two of which grow with the game
 * library and the tag set — used to fill the screen above the first idea.
 * From `md` up the groups render inline and wrap.
 */
export function IdeaFilters({
  value,
  availableTags,
  availableGames = [],
}: IdeaFiltersProps) {
  const router = useRouter();
  // Local, optimistically-updated copy of every filter — not just `q` — so
  // rapid successive clicks (e.g. a format chip immediately followed by a
  // tag chip) compose correctly. Basing `toggle` off the `value` prop
  // instead would lose the first change: that prop only updates once the
  // server round-trips the new searchParams, which a second click can beat.
  const [filters, setFilters] = useState<IdeaFiltersValue>(value);
  const [q, setQ] = useState(value.q ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [allTagsInline, setAllTagsInline] = useState(false);

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
    value.tag !== prevValue.tag ||
    value.game !== prevValue.game
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
    if (next.game) params.set("game", next.game);
    const qs = params.toString();
    router.replace(qs ? `${IDEAS_PATH}?${qs}` : IDEAS_PATH);
  }

  function toggle(key: FilterKey, option: string) {
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
    filters.q || filters.format || filters.status || filters.tag || filters.game
  );

  // What the sheet button counts and the phone's active row lists: the chip
  // filters only. Search text is already visible in the input above them.
  const activeChips: { key: FilterKey; label: string }[] = [];
  if (filters.format && isIdeaFormat(filters.format)) {
    activeChips.push({
      key: "format",
      label: IDEA_FORMAT_LABEL[filters.format],
    });
  }
  if (filters.status && isIdeaStatus(filters.status)) {
    activeChips.push({
      key: "status",
      label: IDEA_STATUS_LABEL[filters.status],
    });
  }
  if (filters.game) {
    const game = availableGames.find((g) => g.id === filters.game);
    if (game) activeChips.push({ key: "game", label: game.name });
  }
  if (filters.tag) activeChips.push({ key: "tag", label: `#${filters.tag}` });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
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

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            render={
              <Button
                type="button"
                variant="outline"
                // The trigger is a phone-only affordance; from `md` up the
                // groups are inline and this button would be a dead end.
                className="md:hidden"
              />
            }
          >
            <SlidersHorizontal aria-hidden className="size-4" />
            Filters
            {activeChips.length > 0 ? (
              <span
                data-slot="active-filter-count"
                className="inline-flex min-w-5 items-center justify-center rounded-full bg-track-content px-1.5 text-caption font-semibold text-track-content-foreground"
              >
                {activeChips.length}
              </span>
            ) : null}
          </SheetTrigger>

          <SheetContent>
            <div className="flex flex-col gap-1">
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>
                Tap a chip to apply it; the list updates behind the sheet.
              </SheetDescription>
            </div>

            <div className="flex flex-col gap-4">
              <FilterGroups
                filters={filters}
                availableTags={availableTags}
                availableGames={availableGames}
                onToggle={toggle}
                labelled
                allTags
              />
            </div>

            {/* Pinned to the sheet's bottom edge: with a long tag set the
                groups scroll, and the way out shouldn't be at the end of
                them. The negative margins let it cover the sheet's own
                padding, safe-area included, so nothing peeks past it. */}
            <div className="sticky -bottom-[calc(1rem+env(safe-area-inset-bottom))] -mx-4 -mb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center justify-between gap-2 border-t border-border bg-popover px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <Button
                type="button"
                variant="ghost"
                onClick={reset}
                disabled={activeChips.length === 0}
              >
                <X aria-hidden className="size-4" />
                Clear all
              </Button>
              <SheetClose render={<Button type="button" />}>Done</SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {activeChips.length > 0 ? (
        <div
          role="group"
          aria-label="Active filters"
          className="flex flex-wrap gap-2 md:hidden"
        >
          {activeChips.map((chip) => (
            <ActiveFilterChip
              key={chip.key}
              label={chip.label}
              onRemove={() => navigate({ ...filters, [chip.key]: undefined })}
            />
          ))}
        </div>
      ) : null}

      <div className="hidden flex-col gap-3 md:flex">
        <FilterGroups
          filters={filters}
          availableTags={availableTags}
          availableGames={availableGames}
          onToggle={toggle}
          allTags={allTagsInline}
          onShowAllTags={setAllTagsInline}
        />
      </div>

      {hasActiveFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          // On a phone the active-chip row already offers per-filter removal
          // and the sheet has "Clear all"; a third control would be clutter.
          // It stays for a search-only narrowing, which has no chip to drop.
          className={cn(
            "self-start",
            activeChips.length > 0 && "hidden md:inline-flex"
          )}
          onClick={reset}
        >
          <X aria-hidden className="size-3.5" />
          Reset filters
        </Button>
      ) : null}
    </div>
  );
}
