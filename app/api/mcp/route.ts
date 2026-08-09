import { createMcpHandler } from "mcp-handler";

import {
  isAuthorizedMcpRequest,
  unauthorizedMcpResponse,
} from "@/lib/mcp/auth";
import {
  MCP_INSTRUCTIONS,
  MCP_SERVER_INFO,
  registerContentTools,
} from "@/lib/mcp/server";

/**
 * The app's own MCP server, over Streamable HTTP (issue #109 — see docs/mcp.md).
 *
 * `mcp-handler` gives us a plain `(Request) => Promise<Response>`, so the whole
 * server ships with the app: no second service, no Redis, no session store, and
 * it works identically on Vercel and locally.
 *
 * Not gated by the session proxy (see proxy.ts's matcher) — MCP clients arrive
 * with no cookie and carry a bearer `MCP_AUTH_TOKEN` instead, exactly like the
 * Vercel cron route and its `CRON_SECRET`. The check runs *before* the handler,
 * so an unauthenticated request never reaches a tool.
 */

const handler = createMcpHandler(registerContentTools, {
  serverInfo: MCP_SERVER_INFO,
  instructions: MCP_INSTRUCTIONS,
});

async function guarded(request: Request): Promise<Response> {
  if (!isAuthorizedMcpRequest(request)) return unauthorizedMcpResponse();
  return handler(request);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
