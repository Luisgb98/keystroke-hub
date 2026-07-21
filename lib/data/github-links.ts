import "server-only";
import { desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { githubIssueLinks } from "@/lib/db/schema";

export interface GithubIssueLinkSummary {
  id: string;
  owner: string;
  repo: string;
  issueNumber: number;
  title: string | null;
  state: "open" | "closed" | null;
  fetchedAt: Date | null;
  /** Always derived, never stored (see docs/github-links.md). */
  url: string;
}

const SELECT_COLUMNS = {
  id: githubIssueLinks.id,
  owner: githubIssueLinks.owner,
  repo: githubIssueLinks.repo,
  issueNumber: githubIssueLinks.issueNumber,
  title: githubIssueLinks.title,
  state: githubIssueLinks.state,
  fetchedAt: githubIssueLinks.fetchedAt,
} as const;

function toSummary(row: {
  id: string;
  owner: string;
  repo: string;
  issueNumber: number;
  title: string | null;
  state: "open" | "closed" | null;
  fetchedAt: Date | null;
}): GithubIssueLinkSummary {
  return {
    ...row,
    url: `https://github.com/${row.owner}/${row.repo}/issues/${row.issueNumber}`,
  };
}

/** GitHub issues linked to a given project, newest-linked-first — backs the `GithubIssueLinkSection` on `/projects/[id]`. */
export async function listGithubIssueLinksForProject(
  projectId: string
): Promise<GithubIssueLinkSummary[]> {
  const db = getDb();
  const rows = await db
    .select(SELECT_COLUMNS)
    .from(githubIssueLinks)
    .where(eq(githubIssueLinks.projectId, projectId))
    .orderBy(desc(githubIssueLinks.createdAt));
  return rows.map(toSummary);
}

/** GitHub issues linked to a given meeting note, newest-linked-first — backs the `GithubIssueLinkSection` on `/projects/meetings/[id]`. */
export async function listGithubIssueLinksForMeetingNote(
  meetingNoteId: string
): Promise<GithubIssueLinkSummary[]> {
  const db = getDb();
  const rows = await db
    .select(SELECT_COLUMNS)
    .from(githubIssueLinks)
    .where(eq(githubIssueLinks.meetingNoteId, meetingNoteId))
    .orderBy(desc(githubIssueLinks.createdAt));
  return rows.map(toSummary);
}

/**
 * Batched (no N+1) GitHub issues for every improvement on `/projects/improvements`
 * — mirrors `getLinkedIdeaSummariesForEvents` in `lib/data/idea-event-links.ts`.
 */
export async function listGithubIssueLinksForImprovements(
  improvementIds: string[]
): Promise<Map<string, GithubIssueLinkSummary[]>> {
  const result = new Map<string, GithubIssueLinkSummary[]>();
  if (improvementIds.length === 0) return result;

  const db = getDb();
  const rows = await db
    .select({
      ...SELECT_COLUMNS,
      improvementId: githubIssueLinks.improvementId,
    })
    .from(githubIssueLinks)
    .where(inArray(githubIssueLinks.improvementId, improvementIds))
    .orderBy(desc(githubIssueLinks.createdAt));

  for (const row of rows) {
    const improvementId = row.improvementId as string;
    const list = result.get(improvementId) ?? [];
    list.push(toSummary(row));
    result.set(improvementId, list);
  }
  return result;
}
