import "server-only";
import { desc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { improvements, projects } from "@/lib/db/schema";
import type { ImprovementStatus } from "@/lib/improvements/improvement-status";
import {
  listGithubIssueLinksForImprovements,
  type GithubIssueLinkSummary,
} from "@/lib/data/github-links";

export interface ImprovementSummary {
  id: string;
  title: string;
  rationale: string | null;
  status: ImprovementStatus;
  outcome: string | null;
  projectId: string | null;
  projectName: string | null;
  createdAt: Date;
  updatedAt: Date;
  githubIssueLinks: GithubIssueLinkSummary[];
}

export interface ImprovementsOverview {
  /** Status `proposed` only, oldest-first — the meeting-ready agenda (see docs/improvements.md). */
  agenda: ImprovementSummary[];
  /** Every improvement, pipeline order then most-recently-updated within each stage. */
  all: ImprovementSummary[];
}

const ALL_SORT_ORDER: Record<ImprovementStatus, number> = {
  proposed: 0,
  discussed: 1,
  accepted: 2,
  done: 3,
  rejected: 4,
};

/** Pure filter+sort, split out so it's unit-testable without a database connection (mirrors `sortProjectSummaries`). */
export function sortImprovementsForAgenda(
  summaries: ImprovementSummary[]
): ImprovementSummary[] {
  return summaries
    .filter((summary) => summary.status === "proposed")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/** Pure sort, split out so it's unit-testable without a database connection. */
export function sortImprovementsForAll(
  summaries: ImprovementSummary[]
): ImprovementSummary[] {
  return [...summaries].sort((a, b) => {
    const statusDiff = ALL_SORT_ORDER[a.status] - ALL_SORT_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

/** Every improvement, project chip data included via a left join (no N+1), split into agenda/all (see docs/improvements.md). */
export async function listImprovements(): Promise<ImprovementsOverview> {
  const db = getDb();

  const rows = await db
    .select({
      id: improvements.id,
      title: improvements.title,
      rationale: improvements.rationale,
      status: improvements.status,
      outcome: improvements.outcome,
      projectId: improvements.projectId,
      projectName: projects.name,
      createdAt: improvements.createdAt,
      updatedAt: improvements.updatedAt,
    })
    .from(improvements)
    .leftJoin(projects, eq(improvements.projectId, projects.id));

  const githubLinksByImprovement = await listGithubIssueLinksForImprovements(
    rows.map((row) => row.id)
  );

  const summaries: ImprovementSummary[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    rationale: row.rationale,
    status: row.status,
    outcome: row.outcome,
    projectId: row.projectId,
    projectName: row.projectName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    githubIssueLinks: githubLinksByImprovement.get(row.id) ?? [],
  }));

  return {
    agenda: sortImprovementsForAgenda(summaries),
    all: sortImprovementsForAll(summaries),
  };
}

export interface LinkableProjectOption {
  id: string;
  name: string;
}

/**
 * Non-archived projects, for the capture/edit form's optional project
 * select — archived projects can't take new links (see docs/improvements.md
 * and docs/projects.md).
 */
export async function listLinkableProjects(): Promise<LinkableProjectOption[]> {
  const db = getDb();
  return db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(isNull(projects.archivedAt))
    .orderBy(projects.name);
}

export interface ProjectImprovementSummary {
  id: string;
  title: string;
  status: ImprovementStatus;
}

/** Improvements linked to a given project, newest first — backs the `ProjectImprovements` sibling section on `/projects/[id]` (see docs/projects.md). */
export async function getImprovementsForProject(
  projectId: string
): Promise<ProjectImprovementSummary[]> {
  const db = getDb();
  return db
    .select({
      id: improvements.id,
      title: improvements.title,
      status: improvements.status,
    })
    .from(improvements)
    .where(eq(improvements.projectId, projectId))
    .orderBy(desc(improvements.createdAt));
}
