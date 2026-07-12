#!/usr/bin/env node
// A minimal stand-in for the GitHub REST issues endpoint, run as a second
// Playwright `webServer` entry (see playwright.config.ts) — mirrors
// fake-google-server.ts. The app's GitHub calls all happen server-side, so
// page-level route interception can't reach them; pointing
// `GITHUB_API_BASE_URL` at this server instead is the same env-gated
// fake-client approach issue #12 established.
//
// State (which issues exist, and their title/state) is controlled per-test
// via the `/__control/*` endpoints. An issue never registered here 404s,
// exercising the "metadata unavailable" fallback path.
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

// Explicit extension: this file is executed directly via plain `node`
// (playwright.config.ts's webServer), whose ESM resolver requires it.
import { FAKE_GITHUB_PORT } from "./credentials.ts";

interface FakeIssue {
  title: string;
  state: "open" | "closed";
}

const issues = new Map<string, FakeIssue>();

function issueKey(owner: string, repo: string, issueNumber: string): string {
  return `${owner}/${repo}#${issueNumber}`.toLowerCase();
}

function send(res: ServerResponse, status: number, body?: unknown) {
  if (body === undefined) {
    res.writeHead(status);
    res.end();
    return;
  }
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(
  req: IncomingMessage
): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${FAKE_GITHUB_PORT}`);
  const method = req.method ?? "GET";
  const body = await readJsonBody(req);

  // --- Test control ---
  if (url.pathname === "/__control/set-issue" && method === "POST") {
    const { owner, repo, issueNumber, title, state } = body as {
      owner: string;
      repo: string;
      issueNumber: number;
      title: string;
      state: "open" | "closed";
    };
    issues.set(issueKey(owner, repo, String(issueNumber)), { title, state });
    return send(res, 200, { ok: true });
  }
  if (url.pathname === "/__control/reset" && method === "POST") {
    issues.clear();
    return send(res, 200, { ok: true });
  }
  if (url.pathname === "/__control/health") {
    return send(res, 200, { ok: true });
  }

  // --- Issues REST surface ---
  const issueMatch = /^\/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)$/.exec(
    url.pathname
  );
  if (issueMatch && method === "GET") {
    const [, owner, repo, issueNumber] = issueMatch;
    const issue = issues.get(issueKey(owner, repo, issueNumber));
    if (!issue) return send(res, 404, { message: "Not Found" });
    return send(res, 200, {
      title: issue.title,
      state: issue.state,
      repository_url: `http://127.0.0.1:${FAKE_GITHUB_PORT}/repos/${owner}/${repo}`,
    });
  }

  send(res, 404, {
    error: `fake-github-server: no handler for ${method} ${url.pathname}`,
  });
});

server.listen(FAKE_GITHUB_PORT, () => {
  console.log(
    `Fake GitHub server listening on http://127.0.0.1:${FAKE_GITHUB_PORT}`
  );
});
