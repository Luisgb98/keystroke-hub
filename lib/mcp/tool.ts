import type { McpServer, ToolAnnotations } from "@modelcontextprotocol/server";
import { z } from "zod";

/**
 * The tiny tool kit the MCP surface is built from (issue #109).
 *
 * Tools are declared as plain data — `{ name, config, handler }` — rather than
 * registered straight onto a server instance, for one reason: a unit test can
 * then call a handler directly with parsed args and assert on what it wrote,
 * with no transport, no server and no HTTP in the way (see the `*.test.ts`
 * files next to each tool module).
 */

/** What every handler returns: JSON text, plus the error flag MCP clients read. */
export interface McpToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  [key: string]: unknown;
}

export interface McpToolConfig {
  title: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  annotations?: ToolAnnotations;
}

export interface McpToolDefinition {
  name: string;
  config: McpToolConfig;
  handler: (args: Record<string, unknown>) => Promise<McpToolResult>;
}

/**
 * Declares a tool, inferring the handler's argument type from its input schema.
 * The two casts erase that inference so a heterogeneous array of tools has one
 * type — the SDK re-derives the real schema from `config.inputSchema` at
 * registration, so nothing is lost on the wire.
 */
export function defineTool<Shape extends z.ZodRawShape>(
  name: string,
  config: {
    title: string;
    description: string;
    inputSchema: z.ZodObject<Shape>;
    annotations?: ToolAnnotations;
  },
  handler: (args: z.output<z.ZodObject<Shape>>) => Promise<McpToolResult>
): McpToolDefinition {
  return {
    name,
    config: config as unknown as McpToolConfig,
    handler: handler as unknown as McpToolDefinition["handler"],
  };
}

/** A successful result: the payload as pretty JSON, which is what an LLM client reads best. */
export function ok(data: unknown): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data ?? null, null, 2) }],
  };
}

/**
 * A failed result. Errors are always `{ error, message, fieldErrors? }` — which
 * field, what rule — never a raw stack trace or database error, so a client can
 * act on them and the repo leaks nothing about its internals.
 */
export function fail(
  message: string,
  fieldErrors?: Record<string, string[] | undefined>
): McpToolResult {
  const cleaned = fieldErrors
    ? Object.fromEntries(
        Object.entries(fieldErrors).filter(([, value]) => value?.length)
      )
    : undefined;

  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            error: "invalid_request",
            message,
            ...(cleaned && Object.keys(cleaned).length > 0
              ? { fieldErrors: cleaned }
              : {}),
          },
          null,
          2
        ),
      },
    ],
  };
}

/** Turns any `{ error?, fieldErrors? }` core result into a tool result. */
export function fromCoreResult<T extends object>(
  result: T & { error?: string; fieldErrors?: Record<string, string[]> },
  payload?: unknown
): McpToolResult {
  if (result.error) return fail(result.error, result.fieldErrors);
  return ok(payload ?? { ok: true });
}

const UNEXPECTED_ERROR =
  "That request failed inside the app. Nothing was reported to the client — check the server logs.";

/**
 * Registers every tool, wrapping each handler so a thrown error (a dropped
 * database connection, a constraint the checks above didn't anticipate) becomes
 * a structured tool error instead of a stack trace crossing the wire.
 */
export function registerTools(
  server: McpServer,
  tools: McpToolDefinition[]
): void {
  for (const tool of tools) {
    server.registerTool(tool.name, tool.config, async (args) => {
      try {
        return await tool.handler(args as Record<string, unknown>);
      } catch (error) {
        console.error(`MCP tool ${tool.name} failed:`, error);
        return fail(UNEXPECTED_ERROR);
      }
    });
  }
}
