// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Nothing here should ever reach the database: the point of these cases is the
// transport and the auth gate in front of it.
vi.mock("@/lib/db", () => ({
  getDb: () => {
    throw new Error("the database must not be touched by these cases");
  },
}));

import { POST } from "./route";

const TOKEN = "route-test-token-0123456789";

const PROTOCOL_VERSION = "2025-06-18";

function rpc(
  body: unknown,
  { token, sessionId }: { token?: string; sessionId?: string } = {}
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    // Streamable HTTP clients must accept both, since the server may answer
    // with either a JSON body or an SSE stream.
    accept: "application/json, text/event-stream",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  if (sessionId) headers["mcp-session-id"] = sessionId;

  return new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "route-test", version: "1.0.0" },
  },
};

/** Reads a JSON-RPC result out of either a JSON body or an SSE stream. */
async function readResult(response: Response): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}> {
  const text = await response.text();
  if (
    (response.headers.get("content-type") ?? "").includes("text/event-stream")
  ) {
    const line = text
      .split("\n")
      .find((candidate) => candidate.startsWith("data:"));
    expect(line, `no SSE data frame in: ${text}`).toBeDefined();
    return JSON.parse(line!.slice("data:".length).trim());
  }
  return JSON.parse(text);
}

beforeEach(() => {
  vi.stubEnv("MCP_AUTH_TOKEN", TOKEN);
});

describe("POST /api/mcp", () => {
  it("rejects a request with no Authorization header", async () => {
    const response = await POST(rpc(INITIALIZE));
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Bearer");
    await expect(response.json()).resolves.toMatchObject({
      error: "unauthorized",
    });
  });

  it("rejects the wrong bearer token", async () => {
    const response = await POST(rpc(INITIALIZE, { token: "nope" }));
    expect(response.status).toBe(401);
  });

  it("fails closed when MCP_AUTH_TOKEN is unset", async () => {
    vi.stubEnv("MCP_AUTH_TOKEN", "");
    const response = await POST(rpc(INITIALIZE, { token: TOKEN }));
    expect(response.status).toBe(401);
  });

  it("initializes for an authorised client", async () => {
    const response = await POST(rpc(INITIALIZE, { token: TOKEN }));
    expect(response.status).toBe(200);
    const message = await readResult(response);
    expect(message.result.serverInfo).toMatchObject({ name: "keystroke-hub" });
    expect(message.result.instructions).toContain("content world");
  });

  it("advertises the whole content tool surface and nothing from the work world", async () => {
    const response = await POST(
      rpc(
        { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
        { token: TOKEN }
      )
    );
    expect(response.status).toBe(200);

    const message = await readResult(response);
    const names: string[] = message.result.tools.map(
      (tool: { name: string }) => tool.name
    );

    expect(names).toContain("list_ideas");
    expect(names).toContain("save_script");
    expect(names).toContain("schedule_stream");
    expect(names).toContain("list_content_events");
    // The work world has no door here (issue #109).
    expect(names.some((name) => name.includes("task"))).toBe(false);
    expect(names.some((name) => name.includes("meeting"))).toBe(false);

    // Every tool arrives with a schema a client can fill in.
    for (const tool of message.result.tools) {
      expect(tool.inputSchema, tool.name).toBeDefined();
      expect(tool.description, tool.name).toBeTruthy();
    }
  });

  it("reports unknown arguments as a structured error, not a crash", async () => {
    const response = await POST(
      rpc(
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "get_idea", arguments: {} },
        },
        { token: TOKEN }
      )
    );
    expect(response.status).toBe(200);

    const message = await readResult(response);
    // Either a JSON-RPC error or a tool result flagged isError — both are
    // structured; what matters is that no stack trace crosses the wire.
    const text = JSON.stringify(message);
    expect(text).not.toContain("at Object.");
    expect(message.error ?? message.result?.isError).toBeTruthy();
  });
});
