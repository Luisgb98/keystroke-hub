"use client";

import { useRef, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Gamepad2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { createGame } from "@/lib/content/game-actions";
import { normalizeGameName, sameGameName } from "@/lib/content/game-schema";
import type { GameOption } from "@/lib/data/games";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Games matching what's been typed, case-insensitively, in the order the
 * library gave them. Pure and exported so the search rule is unit-testable
 * without driving the popup — the same split as `filterNavItems` for the
 * command palette.
 *
 * Matches on substring rather than prefix: "exile" should reach "Path of
 * Exile", which is the whole point of not scrolling a long list.
 */
export function filterGames(games: GameOption[], query: string): GameOption[] {
  const needle = normalizeGameName(query).toLowerCase();
  if (!needle) return games;
  return games.filter((game) => game.name.toLowerCase().includes(needle));
}

/**
 * Whether what's been typed is worth offering as a new library entry: it has
 * to be a real name, and it must not already be in the library under any
 * casing or spacing. That second half is what makes "adding a game that
 * already exists" impossible from the picker — the matching entry is offered
 * for selection instead (see docs/content-games.md).
 */
export function canAddGame(games: GameOption[], query: string): boolean {
  const name = normalizeGameName(query);
  if (!name) return false;
  return !games.some((game) => sameGameName(game.name, name));
}

/**
 * Every row is a real one-handed tap target. The shared command-item row is
 * ~20px tall, which is fine for a keyboard-driven palette and too small for a
 * thumb — this is the picker's own floor (#105).
 */
const ROW = "min-h-9";

interface GamePickerProps {
  /** The whole library, loaded server-side — filtering happens in the browser. */
  games: GameOption[];
  /** Currently-picked game id, or null for "no game". */
  value: string | null;
  onChange: (gameId: string | null) => void;
  /**
   * Form field name for the hidden input carrying the id. Omit when the parent
   * submits its own object rather than a `FormData` (the stream detail page).
   */
  name?: string;
  /** Accessible name for the trigger — pages with two pickers must differ. */
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Pick the game a video idea or a stream is about (issue #105).
 *
 * A themed `Popover` + `cmdk` `Command`, not a native `<select>`: the library
 * grows past what a list is pleasant to scroll, so the search field is the
 * primary way in — type a few letters and the match is one Enter away. `cmdk`
 * carries the combobox/listbox/option roles and the arrow-key loop, so the
 * whole control is keyboard- and screen-reader-operable for free, and the
 * popup surface is `bg-popover` rather than an OS-default white sheet in dark
 * mode.
 *
 * Filtering runs through `filterGames` with `shouldFilter={false}`, matching
 * the command palette: cmdk's own fuzzy scoring would re-order and silently
 * drop matches the exported, tested rule above says should be there.
 *
 * When what's typed isn't in the library, an "Add …" row appears in place of
 * the empty state and creates the entry right here — no trip to the library
 * page first. `createGame` returns the *existing* row when the name collides,
 * so the add path can never produce a second copy.
 */
export function GamePicker({
  games,
  value,
  onChange,
  name,
  label = "Game",
  disabled,
  className,
}: GamePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  // Games added from here, merged over the server-provided list: the parent's
  // `games` prop only refreshes once `revalidatePath` round-trips, which a
  // dialog that's still open would otherwise sit ahead of.
  const [added, setAdded] = useState<GameOption[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const library = [
    ...games,
    ...added.filter((a) => !games.some((g) => g.id === a.id)),
  ];
  const selected = library.find((game) => game.id === value) ?? null;
  const matches = filterGames(library, query);
  const addable = canAddGame(library, query);

  // Reset the search on close by adjusting state during render rather than in
  // an effect — the same idiom as `AttachPicker` (see docs/design-system.md).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setQuery("");
  }

  function select(gameId: string | null) {
    onChange(gameId);
    setOpen(false);
  }

  function handleAdd() {
    const name = normalizeGameName(query);
    if (!name) return;
    startTransition(async () => {
      const result = await createGame(name);
      if (result.error || !result.game) {
        toast.error(result.error ?? "That game couldn't be added.");
        return;
      }
      setAdded((current) =>
        current.some((game) => game.id === result.game!.id)
          ? current
          : [...current, { id: result.game!.id, name: result.game!.name }]
      );
      select(result.game.id);
    });
  }

  return (
    <>
      {/* The id is what the form submits; "" is a deliberate "no game", which
          is why the input is rendered even when nothing is picked. */}
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          render={
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-label={label}
              disabled={disabled}
              className={cn(
                "w-full justify-between font-normal",
                !selected && "text-muted-foreground",
                className
              )}
            />
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            <Gamepad2 aria-hidden className="size-4 shrink-0" />
            <span className="truncate">{selected?.name ?? "No game"}</span>
          </span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 opacity-50" />
        </PopoverTrigger>

        <PopoverContent
          // A stable hook for e2e: the popup is portalled to the body, next to
          // the game *filter* chips on the ideas page, so option lookups have
          // to be scoped to it rather than to the page.
          data-slot="game-picker-popup"
          align="start"
          className="w-(--anchor-width) min-w-56 p-0"
          initialFocus={inputRef}
        >
          {/* `label` is what actually names the search field: cmdk points the
              input's `aria-labelledby` at the visually-hidden label it renders
              from this prop, and that wins over any `aria-label` on the input
              itself — without it the field has no accessible name at all. */}
          <Command shouldFilter={false} loop label="Search games">
            <CommandInput
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder="Search games…"
            />
            <CommandList>
              {value ? (
                <CommandItem
                  value="__clear__"
                  className={ROW}
                  onSelect={() => select(null)}
                >
                  <X aria-hidden className="size-4 shrink-0" />
                  <span>No game</span>
                </CommandItem>
              ) : null}

              {matches.map((game) => (
                <CommandItem
                  key={game.id}
                  value={game.id}
                  className={ROW}
                  onSelect={() => select(game.id)}
                >
                  <Gamepad2 aria-hidden className="size-4 shrink-0" />
                  <span className="truncate">{game.name}</span>
                  {game.id === value ? (
                    <Check aria-hidden className="ml-auto size-4 shrink-0" />
                  ) : null}
                </CommandItem>
              ))}

              {addable ? (
                <CommandItem
                  value="__add__"
                  className={ROW}
                  disabled={pending}
                  onSelect={handleAdd}
                >
                  <Plus aria-hidden className="size-4 shrink-0" />
                  <span className="truncate">
                    Add &ldquo;{normalizeGameName(query)}&rdquo;
                  </span>
                </CommandItem>
              ) : null}

              {/* Deliberately not `CommandEmpty`: cmdk only renders that when
                  it counts zero items, and the "No game" row above is an item
                  — so with a game already picked the empty state would never
                  appear. */}
              {matches.length === 0 && !addable ? (
                <p className="py-6 text-center text-small text-muted-foreground">
                  {library.length === 0
                    ? "No games yet — type a name to add your first one."
                    : "No games match."}
                </p>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
