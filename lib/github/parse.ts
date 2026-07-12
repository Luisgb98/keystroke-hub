// Pure parser for a GitHub issue reference — no network, no DB. Accepts a
// full issue/PR URL or the `owner/repo#123` shorthand (see
// docs/github-links.md). GitHub's issues API resolves PR numbers too, and
// `/issues/{n}` redirects to `/pull/{n}` when `n` is a PR, so both URL forms
// parse to the same shape — no separate "kind" is tracked.

export interface GithubIssueRef {
  owner: string;
  repo: string;
  issueNumber: number;
}

export type ParseGithubIssueRefResult =
  { ok: true; ref: GithubIssueRef } | { ok: false; error: string };

const INVALID_REF_ERROR = "Paste a GitHub issue URL or owner/repo#123.";

// GitHub username/org rules: alphanumeric or single hyphens, no leading,
// trailing, or consecutive hyphens, max 39 characters.
const OWNER_RE = /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/;
// GitHub repo name rules: alphanumeric, hyphen, underscore, period, 1-100 chars.
const REPO_RE = /^[a-zA-Z\d._-]{1,100}$/;

function validateRef(
  owner: string,
  repo: string,
  issueNumberText: string
): ParseGithubIssueRefResult {
  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo)) {
    return { ok: false, error: INVALID_REF_ERROR };
  }
  const issueNumber = Number(issueNumberText);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    return { ok: false, error: INVALID_REF_ERROR };
  }
  return { ok: true, ref: { owner, repo, issueNumber } };
}

const SHORTHAND_RE = /^([^/]+)\/([^/#]+)#(\d+)$/;
const URL_PATH_RE = /^\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)\/?$/;

/**
 * Parses `owner/repo#123` or a full `https://github.com/owner/repo/issues/123`
 * (or `/pull/123`) URL. Returns a typed error rather than throwing — callers
 * (the attach form, `attachGithubIssue`) render `.error` inline, never a crash.
 */
export function parseGithubIssueRef(input: string): ParseGithubIssueRefResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: INVALID_REF_ERROR };

  const shorthandMatch = SHORTHAND_RE.exec(trimmed);
  if (shorthandMatch) {
    const [, owner, repo, issueNumberText] = shorthandMatch;
    return validateRef(owner, repo, issueNumberText);
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: INVALID_REF_ERROR };
  }

  const host = url.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") {
    return { ok: false, error: INVALID_REF_ERROR };
  }

  const pathMatch = URL_PATH_RE.exec(url.pathname);
  if (!pathMatch) return { ok: false, error: INVALID_REF_ERROR };

  const [, owner, repo, issueNumberText] = pathMatch;
  return validateRef(owner, repo, issueNumberText);
}

/** `owner/repo#123` — the canonical display/round-trip form (see `GithubIssueChip`). */
export function formatGithubIssueRef(ref: GithubIssueRef): string {
  return `${ref.owner}/${ref.repo}#${ref.issueNumber}`;
}

/** The GitHub URL is always derived, never stored (see docs/github-links.md). */
export function githubIssueUrl(ref: GithubIssueRef): string {
  return `https://github.com/${ref.owner}/${ref.repo}/issues/${ref.issueNumber}`;
}
