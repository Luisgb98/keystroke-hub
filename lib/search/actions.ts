"use server";

import { verifySession } from "@/lib/auth/session";
import {
  emptySearchResultGroups,
  getRecentItems,
  searchEntities,
  type SearchResultGroups,
} from "@/lib/data/search";
import type { SearchResult } from "@/lib/search/types";

/** Guarded like every other action (see docs/auth.md) — a blank query short-circuits before touching the database. */
export async function searchAll(query: string): Promise<SearchResultGroups> {
  await verifySession();

  const trimmed = query.trim();
  if (!trimmed) return emptySearchResultGroups();

  return searchEntities(trimmed);
}

/** Recently-updated items across every searchable entity, fetched once when the palette opens. */
export async function getRecentPaletteItems(): Promise<SearchResult[]> {
  await verifySession();
  return getRecentItems();
}
