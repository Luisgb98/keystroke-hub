import { FAKE_GITHUB_BASE_URL } from "./credentials";

/** Registers an issue the fake GitHub server will resolve — mirrors `setFakeGoogleEvents`. */
export async function setFakeGithubIssue(issue: {
  owner: string;
  repo: string;
  issueNumber: number;
  title: string;
  state: "open" | "closed";
}): Promise<void> {
  await fetch(`${FAKE_GITHUB_BASE_URL}/__control/set-issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(issue),
  });
}

/** Resets the fake GitHub server — every issue becomes unresolvable (404) again. */
export async function resetFakeGithub(): Promise<void> {
  await fetch(`${FAKE_GITHUB_BASE_URL}/__control/reset`, { method: "POST" });
}
