import { z } from "zod";

/**
 * Shared by `attachGithubIssue`. The real validation (owner/repo/number
 * rules, URL vs. shorthand) lives in `parseGithubIssueRef` — this just
 * guards against an empty submission before that runs.
 */
export const githubIssueRefSchema = z
  .string()
  .trim()
  .min(1, "Paste a GitHub issue URL or owner/repo#123.");

/** Shared by `detachGithubIssue`/`refreshGithubIssueLink`. */
export const githubIssueLinkIdSchema = z.string().min(1);
