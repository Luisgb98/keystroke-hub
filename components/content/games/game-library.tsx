"use client";

import { useState, useTransition } from "react";
import { Check, Gamepad2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  createGame,
  deleteGame,
  getGameUsage,
  renameGame,
} from "@/lib/content/game-actions";
import { normalizeGameName } from "@/lib/content/game-schema";
import type { GameWithUsage } from "@/lib/data/games";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

interface GameLibraryProps {
  games: GameWithUsage[];
}

/** "2 ideas · 1 stream" — plural-correct, and omits a side that's at zero. */
export function usageLabel(ideaCount: number, streamCount: number): string {
  const parts: string[] = [];
  if (ideaCount > 0) {
    parts.push(`${ideaCount} idea${ideaCount === 1 ? "" : "s"}`);
  }
  if (streamCount > 0) {
    parts.push(`${streamCount} stream${streamCount === 1 ? "" : "s"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Not used yet";
}

/**
 * The library page's body: add, rename, delete (issue #105).
 *
 * Renaming is an inline field on the row rather than a dialog — it's a
 * one-word correction, and the rename propagates everywhere by itself because
 * ideas and streams point at the game by id.
 *
 * Deleting always confirms, and the confirmation states what's about to be
 * untagged: usage is re-read from the server at the moment you ask, not taken
 * from the (possibly stale) counts already on screen. Going ahead untags —
 * the rows themselves survive.
 */
export function GameLibrary({ games }: GameLibraryProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirming, setConfirming] = useState<GameWithUsage | null>(null);
  const [confirmUsage, setConfirmUsage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    const name = normalizeGameName(newName);
    if (!name) return;
    startTransition(async () => {
      const result = await createGame(name);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const existed = games.some((game) => game.id === result.game?.id);
      setNewName("");
      toast.success(
        existed
          ? `"${result.game?.name}" is already in your library.`
          : "Game added"
      );
    });
  }

  function startEditing(game: GameWithUsage) {
    setEditingId(game.id);
    setEditingName(game.name);
  }

  function handleRename(game: GameWithUsage) {
    const name = normalizeGameName(editingName);
    if (!name || name === game.name) {
      setEditingId(null);
      return;
    }
    startTransition(async () => {
      const result = await renameGame(game.id, name);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setEditingId(null);
      toast.success("Game renamed");
    });
  }

  function askToDelete(game: GameWithUsage) {
    setConfirming(game);
    setConfirmUsage(null);
    startTransition(async () => {
      const usage = await getGameUsage(game.id);
      setConfirmUsage(usageLabel(usage.ideaCount, usage.streamCount));
    });
  }

  function handleDelete() {
    const game = confirming;
    if (!game) return;
    startTransition(async () => {
      const result = await deleteGame(game.id);
      setConfirming(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`"${game.name}" removed`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Add a game"
          placeholder="Add a game…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button
          type="button"
          disabled={pending || !normalizeGameName(newName)}
          onClick={handleAdd}
        >
          <Plus aria-hidden />
          Add
        </Button>
      </div>

      {games.length === 0 ? (
        <p className="py-10 text-center text-small text-muted-foreground">
          No games yet — add the one you&apos;re playing most and every idea and
          stream can point at it.
        </p>
      ) : (
        <ul data-slot="game-library" className="flex flex-col gap-2">
          {games.map((game) => (
            <li
              key={game.id}
              data-slot="game-row"
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
            >
              {editingId === game.id ? (
                <>
                  <Input
                    autoFocus
                    aria-label={`Rename "${game.name}"`}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleRename(game);
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Save name"
                    disabled={pending}
                    onClick={() => handleRename(game)}
                  >
                    <Check aria-hidden className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Cancel rename"
                    onClick={() => setEditingId(null)}
                  >
                    <X aria-hidden className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Gamepad2
                    aria-hidden
                    className="size-4 shrink-0 text-track-content-foreground"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-small font-medium">
                      {game.name}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      {usageLabel(game.ideaCount, game.streamCount)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Rename "${game.name}"`}
                    onClick={() => startEditing(game)}
                  >
                    <Pencil aria-hidden className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete "${game.name}"`}
                    onClick={() => askToDelete(game)}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{confirming?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmUsage === null
                ? "Checking what uses this game…"
                : confirmUsage === "Not used yet"
                  ? "Nothing is tagged with it — this just removes the library entry."
                  : `${confirmUsage} tagged with it will be untagged. Nothing is deleted — they just lose the game.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending || confirmUsage === null}
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
