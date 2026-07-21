import "server-only";
import { and, desc, eq, ilike, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { ideas, projects, type Project } from "@/lib/db/schema";
import type { IdeaFormat } from "@/lib/content/idea-format";
import type { IdeaStatus } from "@/lib/content/idea-status";
import type { ProjectStatus } from "@/lib/projects/project-status";

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  archivedAt: Date | null;
  linkedIdeaCount: number;
  updatedAt: Date;
}

export interface ProjectsOverview {
  /** Not archived, sorted active -> paused -> done, then most-recently-updated within each. */
  active: ProjectSummary[];
  /** Archived, same secondary sort — hidden behind an explicit filter on `/projects` (see docs/projects.md). */
  archived: ProjectSummary[];
}

const STATUS_ORDER: Record<ProjectStatus, number> = {
  active: 0,
  paused: 1,
  done: 2,
};

/** Pure sort, split out so it's unit-testable without a database connection (mirrors `bucketStreams` in `lib/data/streams.ts`). */
export function sortProjectSummaries(
  summaries: ProjectSummary[]
): ProjectSummary[] {
  return [...summaries].sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

/** Pure split, split out so it's unit-testable without a database connection. */
export function splitArchivedProjects(
  summaries: ProjectSummary[]
): ProjectsOverview {
  const active: ProjectSummary[] = [];
  const archived: ProjectSummary[] = [];
  for (const summary of summaries) {
    (summary.archivedAt ? archived : active).push(summary);
  }
  return {
    active: sortProjectSummaries(active),
    archived: sortProjectSummaries(archived),
  };
}

/**
 * Pure aggregation, split out so it's unit-testable without a database
 * connection (mirrors `aggregateChecklistProgress` in `lib/data/streams.ts`).
 */
export function aggregateLinkedIdeaCounts(
  rows: { projectId: string | null }[]
): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) {
    if (!row.projectId) continue;
    result.set(row.projectId, (result.get(row.projectId) ?? 0) + 1);
  }
  return result;
}

/** Every project, with a linked-idea count per project (no N+1) and split into active/archived (see docs/projects.md). */
export async function listProjects(): Promise<ProjectsOverview> {
  const db = getDb();

  const rows = await db.select().from(projects);
  const linkedRows = await db
    .select({ projectId: ideas.projectId })
    .from(ideas);
  const countByProject = aggregateLinkedIdeaCounts(linkedRows);

  const summaries: ProjectSummary[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    archivedAt: row.archivedAt,
    linkedIdeaCount: countByProject.get(row.id) ?? 0,
    updatedAt: row.updatedAt,
  }));

  return splitArchivedProjects(summaries);
}

export interface LinkedIdeaSummary {
  id: string;
  title: string;
  format: IdeaFormat;
  status: IdeaStatus;
}

export interface ProjectWithLinkedIdeas {
  project: Project;
  /** Chronological (newest first) — the ideas this project's page lists as linked (see the issue's acceptance criteria). */
  linkedIdeas: LinkedIdeaSummary[];
}

export async function getProject(
  id: string
): Promise<ProjectWithLinkedIdeas | null> {
  const db = getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) return null;

  const linkedIdeas = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      format: ideas.format,
      status: ideas.status,
    })
    .from(ideas)
    .where(eq(ideas.projectId, id))
    .orderBy(desc(ideas.createdAt));

  return { project, linkedIdeas };
}

const PICKER_RESULT_LIMIT = 20;

export interface LinkableIdea {
  id: string;
  title: string;
  format: IdeaFormat;
  status: IdeaStatus;
}

/**
 * Ideas with no project yet, optionally filtered by title — backs the
 * "attach an idea" picker on the project detail page. An idea belongs to at
 * most one project (`ideas.projectId` is a bare nullable FK, not a join
 * table, since the relationship is one-to-many, not many-to-many), so
 * "linkable" here deliberately means *unassigned* rather than "not yet
 * linked to this project" — reassigning an idea already on another project
 * is out of scope for this picker (see docs/projects.md).
 */
export async function searchLinkableIdeas(
  query: string
): Promise<LinkableIdea[]> {
  const db = getDb();
  const trimmed = query.trim();
  const conditions = [isNull(ideas.projectId)];
  if (trimmed) conditions.push(ilike(ideas.title, `%${trimmed}%`));

  return db
    .select({
      id: ideas.id,
      title: ideas.title,
      format: ideas.format,
      status: ideas.status,
    })
    .from(ideas)
    .where(and(...conditions))
    .orderBy(desc(ideas.createdAt))
    .limit(PICKER_RESULT_LIMIT);
}

export interface LinkedProjectSummary {
  id: string;
  name: string;
}

/**
 * Project chip data for a batch of ideas (no N+1) — feeds `IdeaCard`'s
 * read-only project chip (see docs/projects.md).
 */
export async function getProjectSummariesForIdeas(
  ideaIds: string[]
): Promise<Map<string, LinkedProjectSummary>> {
  const result = new Map<string, LinkedProjectSummary>();
  if (ideaIds.length === 0) return result;

  const db = getDb();
  const rows = await db
    .select({
      ideaId: ideas.id,
      projectId: projects.id,
      projectName: projects.name,
    })
    .from(ideas)
    .innerJoin(projects, eq(ideas.projectId, projects.id))
    .where(inArray(ideas.id, ideaIds));

  for (const row of rows) {
    result.set(row.ideaId, { id: row.projectId, name: row.projectName });
  }
  return result;
}
