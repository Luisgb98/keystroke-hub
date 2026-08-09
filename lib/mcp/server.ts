import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";

import { registerTools, type McpToolDefinition } from "./tool";
import { eventTools } from "./tools/events";
import { gameTools } from "./tools/games";
import { ideaTools } from "./tools/ideas";
import { linkTools } from "./tools/links";
import { scriptTools } from "./tools/scripts";
import { streamTools } from "./tools/streams";

/**
 * The whole MCP surface, in one list (issue #109 — see docs/mcp.md).
 *
 * Content world only. There is deliberately no tool for tasks, daily/weekly
 * logs, meetings or projects: the two-worlds separation this app is built on
 * applies to machines as much as to the UI.
 */
export const contentTools: McpToolDefinition[] = [
  ...ideaTools,
  ...scriptTools,
  ...streamTools,
  ...gameTools,
  ...linkTools,
  ...eventTools,
];

export const MCP_SERVER_INFO = {
  name: "keystroke-hub",
  version: "1.0.0",
} as const;

export const MCP_INSTRUCTIONS = `Keystroke Hub is a personal app with two strictly separated worlds: work life and content creation. This server exposes the content world only — ideas, scripts, streams, games and the content calendar track. Work-life tasks, logs, meetings and projects are not reachable through any tool here, by design.

Ideas move through a five-stage pipeline: idea -> scripted -> recorded -> edited -> published. Ideas and streams reference a game by id from the library (\`list_games\`), never by name, and tags are free-form hashtags — call \`list_tags\` before inventing one.

Times are the owner's wall clock in the app timezone. Every timestamp comes back as both an absolute instant (\`at\`) and a \`date\`/\`time\` pair; write tools take the \`date\`/\`time\` form. A release with no time given lands at 19:00.

\`update_idea\` and \`update_stream\` replace every field rather than patching, so read the row first. Deletes are permanent and have no undo — confirm with the user before calling one.`;

export function registerContentTools(server: McpServer): void {
  registerTools(server, contentTools);
}
