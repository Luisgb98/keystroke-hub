import "server-only";
import { desc, eq, ilike, ne, or, type SQL } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  dailyLogItems,
  dailyLogs,
  ideas,
  improvements,
  meetingNotes,
  projects,
  scripts,
} from "@/lib/db/schema";
import { formatShortDayLabel } from "@/lib/journal/dates";
import type { SearchResult } from "@/lib/search/types";

/** Per-entity cap on a single search — keeps one noisy table from drowning the rest (see docs/command-palette.md). */
const RESULT_LIMIT_PER_ENTITY = 5;
/** Per-entity fetch size for recents, before the cross-entity merge caps to `RECENT_TOTAL_LIMIT`. */
const RECENT_LIMIT_PER_ENTITY = 5;
const RECENT_TOTAL_LIMIT = 8;
const SNIPPET_LENGTH = 140;

/**
 * Escapes `ILIKE` wildcard metacharacters (`%`, `_`) and the escape character
 * (`\`) itself so a query is matched literally. Without this, `%`/`_` act as
 * wildcards and a trailing `\` leaves a dangling escape that errors the whole
 * search action (e.g. "100%", "C:\"). Relies on Postgres `LIKE`'s default
 * backslash escape character.
 */
export function escapeLikePattern(query: string): string {
  return query.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Wraps an escaped query in a contains-pattern for `ILIKE '%…%'`. */
function containsPattern(query: string): string {
  return `%${escapeLikePattern(query)}%`;
}

/** Server-side truncation so long markdown/plain bodies never blow out a result row (see docs/command-palette.md). */
export function truncateSnippet(
  value: string | null | undefined
): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= SNIPPET_LENGTH) return trimmed;
  return `${trimmed.slice(0, SNIPPET_LENGTH).trimEnd()}…`;
}

// --- Ideas ---

export function buildIdeaSearchCondition(query: string): SQL {
  const pattern = containsPattern(query);
  return or(ilike(ideas.title, pattern), ilike(ideas.notes, pattern))!;
}

interface IdeaSearchRow {
  id: string;
  title: string;
  notes: string | null;
  updatedAt: Date;
}

export function mapIdeaToResult(row: IdeaSearchRow): SearchResult {
  return {
    id: row.id,
    type: "idea",
    world: "content",
    title: row.title,
    snippet: truncateSnippet(row.notes),
    href: `/content/ideas/${row.id}/script`,
    updatedAt: row.updatedAt,
  };
}

const ideaSearchColumns = {
  id: ideas.id,
  title: ideas.title,
  notes: ideas.notes,
  updatedAt: ideas.updatedAt,
};

async function searchIdeas(query: string): Promise<SearchResult[]> {
  const db = getDb();
  const rows = await db
    .select(ideaSearchColumns)
    .from(ideas)
    .where(buildIdeaSearchCondition(query))
    .orderBy(desc(ideas.updatedAt))
    .limit(RESULT_LIMIT_PER_ENTITY);
  return rows.map(mapIdeaToResult);
}

async function recentIdeas(limit: number): Promise<SearchResult[]> {
  const db = getDb();
  const rows = await db
    .select(ideaSearchColumns)
    .from(ideas)
    .orderBy(desc(ideas.updatedAt))
    .limit(limit);
  return rows.map(mapIdeaToResult);
}

// --- Scripts ---

export function buildScriptSearchCondition(query: string): SQL {
  return ilike(scripts.content, containsPattern(query));
}

interface ScriptSearchRow {
  ideaId: string;
  ideaTitle: string;
  content: string;
  updatedAt: Date;
}

/** Scripts have no detail route of their own — a match links to the parent idea, labeled distinctly (see docs/command-palette.md). */
export function mapScriptToResult(row: ScriptSearchRow): SearchResult {
  return {
    id: row.ideaId,
    type: "script",
    world: "content",
    title: row.ideaTitle,
    snippet: truncateSnippet(row.content),
    href: `/content/ideas/${row.ideaId}/script`,
    updatedAt: row.updatedAt,
  };
}

const scriptSearchColumns = {
  ideaId: scripts.ideaId,
  ideaTitle: ideas.title,
  content: scripts.content,
  updatedAt: scripts.updatedAt,
};

async function searchScripts(query: string): Promise<SearchResult[]> {
  const db = getDb();
  const rows = await db
    .select(scriptSearchColumns)
    .from(scripts)
    .innerJoin(ideas, eq(scripts.ideaId, ideas.id))
    .where(buildScriptSearchCondition(query))
    .orderBy(desc(scripts.updatedAt))
    .limit(RESULT_LIMIT_PER_ENTITY);
  return rows.map(mapScriptToResult);
}

async function recentScripts(limit: number): Promise<SearchResult[]> {
  const db = getDb();
  const rows = await db
    .select(scriptSearchColumns)
    .from(scripts)
    .innerJoin(ideas, eq(scripts.ideaId, ideas.id))
    // Empty-content scripts don't count as "has a script" — mirrors
    // `getIdeaIdsWithScripts` in lib/data/scripts.ts.
    .where(ne(scripts.content, ""))
    .orderBy(desc(scripts.updatedAt))
    .limit(limit);
  return rows.map(mapScriptToResult);
}

// --- Daily logs ---

export interface DailyLogMatchRow {
  logDate: string;
  updatedAt: Date;
  snippet: string;
}

/**
 * A daily log can match on its retro *and* an item's title in the same
 * query — this dedupes both into one row per `logDate`, keeping the
 * most-recently-updated candidate (see docs/command-palette.md).
 */
export function mergeDailyLogMatches(
  rows: DailyLogMatchRow[],
  limit: number
): DailyLogMatchRow[] {
  const byDate = new Map<string, DailyLogMatchRow>();
  for (const row of rows) {
    const existing = byDate.get(row.logDate);
    if (!existing || row.updatedAt.getTime() > existing.updatedAt.getTime()) {
      byDate.set(row.logDate, row);
    }
  }
  return [...byDate.values()]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}

export function mapDailyLogMatchToResult(row: DailyLogMatchRow): SearchResult {
  return {
    id: row.logDate,
    type: "daily-log",
    world: "work",
    title: `Daily log — ${formatShortDayLabel(row.logDate)}`,
    snippet: truncateSnippet(row.snippet),
    href: `/journal?date=${row.logDate}`,
    updatedAt: row.updatedAt,
  };
}

async function searchDailyLogs(query: string): Promise<SearchResult[]> {
  const db = getDb();
  const pattern = containsPattern(query);

  const retroRows = await db
    .select({
      logDate: dailyLogs.logDate,
      updatedAt: dailyLogs.updatedAt,
      snippet: dailyLogs.retro,
    })
    .from(dailyLogs)
    .where(ilike(dailyLogs.retro, pattern))
    .orderBy(desc(dailyLogs.updatedAt))
    .limit(RESULT_LIMIT_PER_ENTITY);

  const itemRows = await db
    .select({
      logDate: dailyLogs.logDate,
      updatedAt: dailyLogItems.updatedAt,
      snippet: dailyLogItems.title,
    })
    .from(dailyLogItems)
    .innerJoin(dailyLogs, eq(dailyLogItems.logId, dailyLogs.id))
    .where(ilike(dailyLogItems.title, pattern))
    .orderBy(desc(dailyLogItems.updatedAt))
    .limit(RESULT_LIMIT_PER_ENTITY);

  const merged = mergeDailyLogMatches(
    [
      ...retroRows.map((row) => ({
        logDate: row.logDate,
        updatedAt: row.updatedAt,
        snippet: row.snippet ?? "",
      })),
      ...itemRows,
    ],
    RESULT_LIMIT_PER_ENTITY
  );
  return merged.map(mapDailyLogMatchToResult);
}

async function recentDailyLogs(limit: number): Promise<SearchResult[]> {
  const db = getDb();
  const rows = await db
    .select({
      logDate: dailyLogs.logDate,
      updatedAt: dailyLogs.updatedAt,
      retro: dailyLogs.retro,
    })
    .from(dailyLogs)
    .orderBy(desc(dailyLogs.updatedAt))
    .limit(limit);
  return rows.map((row) =>
    mapDailyLogMatchToResult({
      logDate: row.logDate,
      updatedAt: row.updatedAt,
      snippet: row.retro ?? "",
    })
  );
}

// --- Meeting notes ---

export function buildMeetingNoteSearchCondition(query: string): SQL {
  const pattern = containsPattern(query);
  return or(
    ilike(meetingNotes.title, pattern),
    ilike(meetingNotes.notes, pattern),
    ilike(meetingNotes.reflection, pattern)
  )!;
}

interface MeetingNoteSearchRow {
  id: string;
  title: string;
  notes: string;
  updatedAt: Date;
}

export function mapMeetingNoteToResult(
  row: MeetingNoteSearchRow
): SearchResult {
  return {
    id: row.id,
    type: "meeting-note",
    world: "work",
    title: row.title,
    snippet: truncateSnippet(row.notes),
    href: `/projects/meetings/${row.id}`,
    updatedAt: row.updatedAt,
  };
}

const meetingNoteSearchColumns = {
  id: meetingNotes.id,
  title: meetingNotes.title,
  notes: meetingNotes.notes,
  updatedAt: meetingNotes.updatedAt,
};

async function searchMeetingNotes(query: string): Promise<SearchResult[]> {
  const db = getDb();
  const rows = await db
    .select(meetingNoteSearchColumns)
    .from(meetingNotes)
    .where(buildMeetingNoteSearchCondition(query))
    .orderBy(desc(meetingNotes.updatedAt))
    .limit(RESULT_LIMIT_PER_ENTITY);
  return rows.map(mapMeetingNoteToResult);
}

async function recentMeetingNotes(limit: number): Promise<SearchResult[]> {
  const db = getDb();
  const rows = await db
    .select(meetingNoteSearchColumns)
    .from(meetingNotes)
    .orderBy(desc(meetingNotes.updatedAt))
    .limit(limit);
  return rows.map(mapMeetingNoteToResult);
}

// --- Projects ---

export function buildProjectSearchCondition(query: string): SQL {
  const pattern = containsPattern(query);
  return or(
    ilike(projects.name, pattern),
    ilike(projects.description, pattern),
    ilike(projects.notes, pattern)
  )!;
}

interface ProjectSearchRow {
  id: string;
  name: string;
  description: string | null;
  updatedAt: Date;
}

export function mapProjectToResult(row: ProjectSearchRow): SearchResult {
  return {
    id: row.id,
    type: "project",
    world: "work",
    title: row.name,
    snippet: truncateSnippet(row.description),
    href: `/projects/${row.id}`,
    updatedAt: row.updatedAt,
  };
}

const projectSearchColumns = {
  id: projects.id,
  name: projects.name,
  description: projects.description,
  updatedAt: projects.updatedAt,
};

async function searchProjects(query: string): Promise<SearchResult[]> {
  const db = getDb();
  const rows = await db
    .select(projectSearchColumns)
    .from(projects)
    .where(buildProjectSearchCondition(query))
    .orderBy(desc(projects.updatedAt))
    .limit(RESULT_LIMIT_PER_ENTITY);
  return rows.map(mapProjectToResult);
}

async function recentProjects(limit: number): Promise<SearchResult[]> {
  const db = getDb();
  const rows = await db
    .select(projectSearchColumns)
    .from(projects)
    .orderBy(desc(projects.updatedAt))
    .limit(limit);
  return rows.map(mapProjectToResult);
}

// --- Improvements ---

export function buildImprovementSearchCondition(query: string): SQL {
  const pattern = containsPattern(query);
  return or(
    ilike(improvements.title, pattern),
    ilike(improvements.rationale, pattern),
    ilike(improvements.outcome, pattern)
  )!;
}

interface ImprovementSearchRow {
  id: string;
  title: string;
  rationale: string | null;
  updatedAt: Date;
}

/** No detail route exists for a single improvement — every result links to the backlog list (see docs/command-palette.md). */
export function mapImprovementToResult(
  row: ImprovementSearchRow
): SearchResult {
  return {
    id: row.id,
    type: "improvement",
    world: "work",
    title: row.title,
    snippet: truncateSnippet(row.rationale),
    href: "/projects/improvements",
    updatedAt: row.updatedAt,
  };
}

const improvementSearchColumns = {
  id: improvements.id,
  title: improvements.title,
  rationale: improvements.rationale,
  updatedAt: improvements.updatedAt,
};

async function searchImprovements(query: string): Promise<SearchResult[]> {
  const db = getDb();
  const rows = await db
    .select(improvementSearchColumns)
    .from(improvements)
    .where(buildImprovementSearchCondition(query))
    .orderBy(desc(improvements.updatedAt))
    .limit(RESULT_LIMIT_PER_ENTITY);
  return rows.map(mapImprovementToResult);
}

async function recentImprovements(limit: number): Promise<SearchResult[]> {
  const db = getDb();
  const rows = await db
    .select(improvementSearchColumns)
    .from(improvements)
    .orderBy(desc(improvements.updatedAt))
    .limit(limit);
  return rows.map(mapImprovementToResult);
}

// --- Orchestration ---

/** One group per searchable entity — the palette renders one `CommandGroup` per non-empty key (see docs/command-palette.md). */
export interface SearchResultGroups {
  ideas: SearchResult[];
  scripts: SearchResult[];
  dailyLogs: SearchResult[];
  meetingNotes: SearchResult[];
  projects: SearchResult[];
  improvements: SearchResult[];
}

export function emptySearchResultGroups(): SearchResultGroups {
  return {
    ideas: [],
    scripts: [],
    dailyLogs: [],
    meetingNotes: [],
    projects: [],
    improvements: [],
  };
}

/** One query per entity, run concurrently and capped independently — see docs/command-palette.md. */
export async function searchEntities(
  query: string
): Promise<SearchResultGroups> {
  const [
    ideaResults,
    scriptResults,
    dailyLogResults,
    meetingNoteResults,
    projectResults,
    improvementResults,
  ] = await Promise.all([
    searchIdeas(query),
    searchScripts(query),
    searchDailyLogs(query),
    searchMeetingNotes(query),
    searchProjects(query),
    searchImprovements(query),
  ]);

  return {
    ideas: ideaResults,
    scripts: scriptResults,
    dailyLogs: dailyLogResults,
    meetingNotes: meetingNoteResults,
    projects: projectResults,
    improvements: improvementResults,
  };
}

/** Cross-entity merge for recents — newest-updated-first, capped to `limit` regardless of which entity they came from. */
export function mergeRecentCandidates(
  candidates: SearchResult[],
  limit: number
): SearchResult[] {
  return [...candidates]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}

/**
 * "Recently updated", server-side, across every searchable entity — shown
 * before the user types anything (see docs/command-palette.md). Every
 * table already carries `updatedAt`, so this needs no tracking
 * infrastructure beyond a per-entity top-N fetch and a cross-entity merge.
 */
export async function getRecentItems(
  limit: number = RECENT_TOTAL_LIMIT
): Promise<SearchResult[]> {
  const [
    ideaResults,
    scriptResults,
    dailyLogResults,
    meetingNoteResults,
    projectResults,
    improvementResults,
  ] = await Promise.all([
    recentIdeas(RECENT_LIMIT_PER_ENTITY),
    recentScripts(RECENT_LIMIT_PER_ENTITY),
    recentDailyLogs(RECENT_LIMIT_PER_ENTITY),
    recentMeetingNotes(RECENT_LIMIT_PER_ENTITY),
    recentProjects(RECENT_LIMIT_PER_ENTITY),
    recentImprovements(RECENT_LIMIT_PER_ENTITY),
  ]);

  return mergeRecentCandidates(
    [
      ...ideaResults,
      ...scriptResults,
      ...dailyLogResults,
      ...meetingNoteResults,
      ...projectResults,
      ...improvementResults,
    ],
    limit
  );
}
