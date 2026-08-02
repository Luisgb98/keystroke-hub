import { z } from "zod";

/**
 * Long enough for the real outliers ("Path of Exile 2: Dawn of the Hunt"),
 * short enough that a pasted paragraph can't become a library entry.
 */
export const MAX_GAME_NAME_LENGTH = 80;

/**
 * The one normalization rule for a game name, applied before *every* write and
 * every duplicate check (see docs/content-games.md).
 *
 * Trims the ends and collapses internal runs of whitespace, so "  PoE   league "
 * and "PoE league" are the same name — casing is deliberately preserved (the
 * library shows the name as typed), and the case-insensitive half of the
 * dedupe lives in the `lower(name)` unique index plus `sameGameName` below.
 */
export function normalizeGameName(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_GAME_NAME_LENGTH);
}

/**
 * Whether two raw names denote the same library entry — normalized, then
 * compared case-insensitively. The single source of truth for "adding a game
 * that already exists doesn't create a second copy", shared by the picker's
 * client-side exact-match check and the actions' server-side lookup, so the
 * two can't drift apart.
 */
export function sameGameName(a: string, b: string): boolean {
  return (
    normalizeGameName(a).toLowerCase() === normalizeGameName(b).toLowerCase()
  );
}

/** Normalizing before validating means whitespace-only input fails as "required", not as a stray space. */
const gameNameField = z
  .string()
  .transform(normalizeGameName)
  .pipe(
    z
      .string()
      .min(1, "Name is required")
      .max(
        MAX_GAME_NAME_LENGTH,
        `Keep the name under ${MAX_GAME_NAME_LENGTH} characters`
      )
  );

/** Shared by `createGame` and the picker's inline "add it right there" path. */
export const gameCreateSchema = z.object({ name: gameNameField });

/** Shared by `renameGame` — same name rules, plus which entry to rewrite. */
export const gameRenameSchema = z.object({
  id: z.uuid("That game no longer exists."),
  name: gameNameField,
});

export const gameIdSchema = z.uuid("That game no longer exists.");

/**
 * The `gameId` a form submits: a real id, or empty for "no game". Kept as its
 * own schema because both the idea and the stream forms carry the field, and
 * an unrecognised id must clear the tag rather than fail the whole save (see
 * `resolveGameId` in lib/content/game-actions.ts).
 */
export const gameIdFieldSchema = z
  .string()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));
