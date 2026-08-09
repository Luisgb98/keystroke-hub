import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Bearer-token auth for the MCP endpoint (issue #109).
 *
 * The app's human door is a session cookie (`lib/auth/session.ts`); the machine
 * door is a single static token in `MCP_AUTH_TOKEN`, exactly like the
 * `CRON_SECRET` the Vercel cron route carries. The repo is public, so the token
 * only ever lives in the environment — `.env.example` documents it and nothing
 * commits it. Rotating it means changing the env var and redeploying.
 *
 * Comparison is constant-time in the same spirit as `verifyPassword`: both
 * sides are hashed first so `timingSafeEqual` always gets equal-length buffers
 * (it throws otherwise) and the presented token's *length* leaks nothing.
 */

export const MCP_TOKEN_ENV = "MCP_AUTH_TOKEN";

const BEARER_RE = /^Bearer\s+(.+)$/i;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** The bearer token on a request, or `null` when the header is missing or isn't a bearer one. */
export function bearerTokenOf(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = BEARER_RE.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Whether a request may drive the MCP server. An unset (or empty) env var
 * fails *closed*: a deployment that forgot to configure the token exposes
 * nothing rather than everything.
 */
export function isAuthorizedMcpRequest(request: Request): boolean {
  const expected = process.env[MCP_TOKEN_ENV];
  if (!expected || expected.length === 0) return false;

  const presented = bearerTokenOf(request);
  if (!presented) return false;

  return timingSafeEqual(digest(presented), digest(expected));
}

/** The one 401 shape the endpoint ever returns — structured, and never says which half was wrong. */
export function unauthorizedMcpResponse(): Response {
  return Response.json(
    {
      error: "unauthorized",
      message:
        "This endpoint requires a bearer token. Send `Authorization: Bearer <MCP_AUTH_TOKEN>`.",
    },
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="keystroke-hub"' },
    }
  );
}
