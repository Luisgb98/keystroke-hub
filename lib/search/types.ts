import type { Track } from "@/lib/calendar/types";

/**
 * The searchable entity vocabulary — one value per table the palette reads
 * from (see docs/command-palette.md). Scripts have no detail route of their
 * own, so a script result links to its parent idea but keeps its own type
 * so the palette can label it distinctly from an idea match.
 */
export type SearchResultType =
  "idea" | "script" | "daily-log" | "meeting-note" | "project" | "improvement";

/**
 * The provider contract every entity maps its rows onto — future entities
 * (e.g. streams) plug into the palette by adding a mapper that produces
 * this shape, never by touching palette UI (see docs/command-palette.md).
 */
export interface SearchResult {
  id: string;
  type: SearchResultType;
  world: Track;
  title: string;
  /** Server-truncated matched text; absent when the entity has none to show. */
  snippet?: string;
  href: string;
  updatedAt: Date;
}
