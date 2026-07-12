"use server";

import { randomUUID } from "node:crypto";
import { and, eq, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  githubIssueLinks,
  improvements,
  meetingNotes,
  projects,
} from "@/lib/db/schema";

import { fetchIssueMetadata } from "./api";
import { githubIssueLinkIdSchema, githubIssueRefSchema } from "./link-schema";
import { parseGithubIssueRef } from "./parse";

/**
 * Discriminated union instead of three near-identical action files — see
 * docs/github-links.md. Each variant's `id` is validated against the
 * matching table (existence + not-archived for projects) before any write.
 */
export type GithubLinkTarget =
  | { type: "project"; id: string }
  | { type: "improvement"; id: string }
  | { type: "meetingNote"; id: string };

export interface GithubLinkMutationResult {
  error?: string;
  linkId?: string;
}

const ARCHIVED_PROJECT_ERROR = "Archived projects can't take new links.";

const TARGET_COLUMN = {
  project: githubIssueLinks.projectId,
  improvement: githubIssueLinks.improvementId,
  meetingNote: githubIssueLinks.meetingNoteId,
} as const;

/** Only one host surface renders each target's links, so one `revalidatePath` per target type is enough (see docs/github-links.md). */
function revalidateForTarget(target: GithubLinkTarget): void {
  switch (target.type) {
    case "project":
      revalidatePath(`/projects/${target.id}`);
      return;
    case "improvement":
      revalidatePath("/projects/improvements");
      return;
    case "meetingNote":
      revalidatePath(`/projects/meetings/${target.id}`);
      return;
  }
}

function targetFromRow(row: {
  projectId: string | null;
  improvementId: string | null;
  meetingNoteId: string | null;
}): GithubLinkTarget {
  if (row.projectId) return { type: "project", id: row.projectId };
  if (row.improvementId) {
    return { type: "improvement", id: row.improvementId };
  }
  return { type: "meetingNote", id: row.meetingNoteId as string };
}

/**
 * Rejects an unknown target or (for a project) an archived one — same
 * guard shape as `checkLinkableProject` in lib/improvements/actions.ts and
 * lib/meetings/actions.ts.
 */
async function checkLinkableTarget(
  target: GithubLinkTarget
): Promise<string | undefined> {
  const db = getDb();

  if (target.type === "project") {
    const [project] = await db
      .select({ id: projects.id, archivedAt: projects.archivedAt })
      .from(projects)
      .where(eq(projects.id, target.id));
    if (!project) return "That project no longer exists.";
    if (project.archivedAt) return ARCHIVED_PROJECT_ERROR;
    return undefined;
  }

  if (target.type === "improvement") {
    const [improvement] = await db
      .select({ id: improvements.id })
      .from(improvements)
      .where(eq(improvements.id, target.id));
    return improvement ? undefined : "That improvement no longer exists.";
  }

  const [meetingNote] = await db
    .select({ id: meetingNotes.id })
    .from(meetingNotes)
    .where(eq(meetingNotes.id, target.id));
  return meetingNote ? undefined : "That meeting note no longer exists.";
}

/**
 * Attaches a GitHub issue by URL or `owner/repo#123` shorthand. Metadata
 * (title/state) is fetched best-effort at attach time — a failed fetch
 * never blocks the attach, it just leaves the cached snapshot null (see
 * docs/github-links.md). Re-attaching an issue already linked to this item
 * is an idempotent success, matching `linkImprovementToMeetingNote`'s shape.
 */
export async function attachGithubIssue(
  target: GithubLinkTarget,
  rawRef: string
): Promise<GithubLinkMutationResult> {
  await verifySession();

  const parsedInput = githubIssueRefSchema.safeParse(rawRef);
  if (!parsedInput.success) {
    return {
      error:
        parsedInput.error.issues[0]?.message ??
        "That isn't a valid GitHub issue reference.",
    };
  }

  const parsedRef = parseGithubIssueRef(parsedInput.data);
  if (!parsedRef.ok) return { error: parsedRef.error };

  const targetError = await checkLinkableTarget(target);
  if (targetError) return { error: targetError };

  const db = getDb();
  const column = TARGET_COLUMN[target.type];
  const [existing] = await db
    .select({ id: githubIssueLinks.id })
    .from(githubIssueLinks)
    .where(
      and(
        eq(column, target.id),
        ilike(githubIssueLinks.owner, parsedRef.ref.owner),
        ilike(githubIssueLinks.repo, parsedRef.ref.repo),
        eq(githubIssueLinks.issueNumber, parsedRef.ref.issueNumber)
      )
    );
  if (existing) {
    revalidateForTarget(target);
    return { linkId: existing.id };
  }

  const metadataResult = await fetchIssueMetadata(
    parsedRef.ref.owner,
    parsedRef.ref.repo,
    parsedRef.ref.issueNumber
  );

  const id = randomUUID();
  await db.insert(githubIssueLinks).values({
    id,
    projectId: target.type === "project" ? target.id : null,
    improvementId: target.type === "improvement" ? target.id : null,
    meetingNoteId: target.type === "meetingNote" ? target.id : null,
    owner: metadataResult.ok
      ? metadataResult.metadata.owner
      : parsedRef.ref.owner,
    repo: metadataResult.ok ? metadataResult.metadata.repo : parsedRef.ref.repo,
    issueNumber: parsedRef.ref.issueNumber,
    title: metadataResult.ok ? metadataResult.metadata.title : null,
    state: metadataResult.ok ? metadataResult.metadata.state : null,
    fetchedAt: metadataResult.ok ? new Date() : null,
  });

  revalidateForTarget(target);
  return { linkId: id };
}

/** Removes a link. Detach only — the app never writes to GitHub itself. */
export async function detachGithubIssue(
  linkId: string
): Promise<GithubLinkMutationResult> {
  await verifySession();

  const parsed = githubIssueLinkIdSchema.safeParse(linkId);
  if (!parsed.success) return { error: "That link isn't valid." };

  const db = getDb();
  const [deleted] = await db
    .delete(githubIssueLinks)
    .where(eq(githubIssueLinks.id, parsed.data))
    .returning({
      projectId: githubIssueLinks.projectId,
      improvementId: githubIssueLinks.improvementId,
      meetingNoteId: githubIssueLinks.meetingNoteId,
    });
  if (!deleted) return { error: "That link no longer exists." };

  revalidateForTarget(targetFromRow(deleted));
  return {};
}

/**
 * Re-fetches title/state on demand — the attach-time snapshot's only
 * refresh path (see docs/github-links.md open question 2: manual refresh
 * over a background poll). A failed fetch leaves the existing snapshot
 * untouched rather than clearing it.
 */
export async function refreshGithubIssueLink(
  linkId: string
): Promise<GithubLinkMutationResult> {
  await verifySession();

  const parsed = githubIssueLinkIdSchema.safeParse(linkId);
  if (!parsed.success) return { error: "That link isn't valid." };

  const db = getDb();
  const [link] = await db
    .select({
      id: githubIssueLinks.id,
      owner: githubIssueLinks.owner,
      repo: githubIssueLinks.repo,
      issueNumber: githubIssueLinks.issueNumber,
      projectId: githubIssueLinks.projectId,
      improvementId: githubIssueLinks.improvementId,
      meetingNoteId: githubIssueLinks.meetingNoteId,
    })
    .from(githubIssueLinks)
    .where(eq(githubIssueLinks.id, parsed.data));
  if (!link) return { error: "That link no longer exists." };

  const metadataResult = await fetchIssueMetadata(
    link.owner,
    link.repo,
    link.issueNumber
  );
  if (!metadataResult.ok) {
    return {
      error:
        metadataResult.reason === "rate_limited"
          ? "GitHub rate-limited this request — try again later."
          : "Couldn't reach GitHub for this issue.",
    };
  }

  await db
    .update(githubIssueLinks)
    .set({
      owner: metadataResult.metadata.owner,
      repo: metadataResult.metadata.repo,
      title: metadataResult.metadata.title,
      state: metadataResult.metadata.state,
      fetchedAt: new Date(),
    })
    .where(eq(githubIssueLinks.id, link.id));

  revalidateForTarget(targetFromRow(link));
  return { linkId: link.id };
}
