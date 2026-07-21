import "server-only";

// `GITHUB_API_BASE_URL` overrides the base URL — e2e specs point this at a
// local fake server (mirrors `GOOGLE_CALENDAR_API_BASE_URL` in
// lib/google/client.ts), since these calls happen server-side and never
// touch the browser page Playwright can otherwise hook into.
const API_BASE = process.env.GITHUB_API_BASE_URL ?? "https://api.github.com";

export interface GithubIssueMetadata {
  /** Canonical casing from the API response — may differ from what the user pasted (a rename/redirect). */
  owner: string;
  repo: string;
  title: string;
  state: "open" | "closed";
}

export type FetchIssueMetadataResult =
  | { ok: true; metadata: GithubIssueMetadata }
  | { ok: false; reason: "not_found" | "rate_limited" | "unavailable" };

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  // Optional — lifts the unauthenticated 60 req/h limit to 5000 and enables
  // private-repo metadata (see .env.example). Never required.
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

/** Pulls canonical `owner`/`repo` out of the API's `repository_url`, falling back to what was requested if the shape is unexpected. */
function resolveOwnerRepo(
  data: Record<string, unknown>,
  fallbackOwner: string,
  fallbackRepo: string
): { owner: string; repo: string } {
  const repositoryUrl = data.repository_url;
  if (typeof repositoryUrl === "string") {
    const match = /\/repos\/([^/]+)\/([^/]+)$/.exec(repositoryUrl);
    if (match) return { owner: match[1], repo: match[2] };
  }
  return { owner: fallbackOwner, repo: fallbackRepo };
}

/**
 * `GET /repos/{owner}/{repo}/issues/{number}` — read-only, the app's only
 * kind of GitHub traffic (see docs/github-links.md). Never throws: network
 * failure, 404, and rate-limiting all resolve to a typed `{ ok: false }`,
 * since a metadata fetch failing must never block attaching a link.
 */
export async function fetchIssueMetadata(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<FetchIssueMetadataResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
      { headers: authHeaders() }
    );
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (response.status === 404) return { ok: false, reason: "not_found" };
  if (response.status === 403 || response.status === 429) {
    return { ok: false, reason: "rate_limited" };
  }
  if (!response.ok) return { ok: false, reason: "unavailable" };

  const data = (await response.json()) as Record<string, unknown>;
  const { owner: canonicalOwner, repo: canonicalRepo } = resolveOwnerRepo(
    data,
    owner,
    repo
  );

  return {
    ok: true,
    metadata: {
      owner: canonicalOwner,
      repo: canonicalRepo,
      title: typeof data.title === "string" ? data.title : `#${issueNumber}`,
      // A merged PR still reports `state: "closed"` — the app doesn't track
      // a separate "merged" state (see docs/github-links.md).
      state: data.state === "closed" ? "closed" : "open",
    },
  };
}
