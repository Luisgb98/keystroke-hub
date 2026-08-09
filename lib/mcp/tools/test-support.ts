import { expect } from "vitest";

import type { McpToolDefinition, McpToolResult } from "../tool";

/**
 * Shared helpers for the tool-handler tests. Handlers are declared as plain
 * data (see `../tool.ts`), so a test can call one directly with parsed
 * arguments — no transport, no server, no HTTP.
 */

/** Looks up a tool by name, failing loudly if it was renamed out from under a test. */
export function toolNamed(
  tools: McpToolDefinition[],
  name: string
): McpToolDefinition {
  const tool = tools.find((candidate) => candidate.name === name);
  expect(tool, `no MCP tool named "${name}"`).toBeDefined();
  return tool!;
}

/** Calls a tool with already-parsed arguments (the SDK does the zod parse in production). */
export function callTool(
  tools: McpToolDefinition[],
  name: string,
  args: Record<string, unknown> = {}
): Promise<McpToolResult> {
  return toolNamed(tools, name).handler(args);
}

/** The JSON body a tool put on the wire. */
export function payloadOf(result: McpToolResult): {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
} {
  return JSON.parse(result.content[0].text);
}
