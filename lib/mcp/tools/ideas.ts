import "server-only";

import { z } from "zod";

import {
  clearIdeaReleaseCore,
  createIdeaCore,
  deleteIdeaCore,
  setIdeaReleaseCore,
  updateIdeaCore,
  updateIdeaStatusCore,
} from "@/lib/content/core/ideas";
import {
  getDistinctIdeaTags,
  getIdeas,
  type IdeaFilters,
} from "@/lib/data/ideas";
import { getGamesById } from "@/lib/data/games";
import { getIdeaChecklistItems } from "@/lib/data/idea-checklists";
import { getScheduledEventsForIdeas } from "@/lib/data/idea-event-links";
import { getIdeaIdsWithScripts, getIdeaWithScript } from "@/lib/data/scripts";
import type { Game, Idea } from "@/lib/db/schema";

import {
  dateParam,
  idParam,
  ideaFormatParam,
  ideaStatusParam,
  tagsParam,
  tagsToRaw,
  timeParam,
} from "../params";
import { serializeInstant, serializeSlot } from "../serialize";
import {
  defineTool,
  fail,
  fromCoreResult,
  ok,
  type McpToolDefinition,
} from "../tool";

/**
 * Idea tools — the content pipeline, end to end (issue #109). Every write goes
 * through `lib/content/core/ideas.ts`, the same module the capture dialog and
 * the board call, so an MCP-captured idea is byte-for-byte a UI-captured one.
 */

interface LinkedEvent {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
}

function serializeGame(
  gameId: string | null,
  games: Map<string, Game>
): { id: string; name: string } | null {
  if (!gameId) return null;
  const game = games.get(gameId);
  return game ? { id: game.id, name: game.name } : null;
}

/** The release is the idea's own managed event — found among its links by id. */
function serializeRelease(idea: Idea, linked: LinkedEvent[]) {
  if (!idea.releaseEventId) return null;
  const event = linked.find((row) => row.id === idea.releaseEventId);
  if (!event) return null;
  return { eventId: event.id, ...serializeInstant(event.startsAt) };
}

function serializeIdeaSummary(
  idea: Idea,
  games: Map<string, Game>,
  linked: LinkedEvent[],
  hasScript: boolean
) {
  return {
    id: idea.id,
    title: idea.title,
    description: idea.description,
    format: idea.format,
    status: idea.status,
    tags: idea.tags,
    game: serializeGame(idea.gameId, games),
    release: serializeRelease(idea, linked),
    hasScript,
    createdAt: idea.createdAt.toISOString(),
    stageEnteredAt: idea.stageEnteredAt.toISOString(),
  };
}

const listIdeas = defineTool(
  "list_ideas",
  {
    title: "List ideas",
    description:
      "Lists video/stream ideas, newest first, with the same filters the ideas page has. Every filter is optional and they combine (AND).",
    inputSchema: z.object({
      q: z.string().optional().describe("Case-insensitive title search."),
      format: ideaFormatParam.optional(),
      status: ideaStatusParam.optional().describe("Pipeline stage."),
      tag: z
        .string()
        .optional()
        .describe("An exact tag, as `list_tags` returns it."),
      game: idParam
        .optional()
        .describe("A game's id from `list_games` — not its name."),
    }),
    annotations: { readOnlyHint: true },
  },
  async (args) => {
    const filters: IdeaFilters = {
      q: args.q,
      format: args.format,
      status: args.status,
      tag: args.tag,
      game: args.game,
    };
    const ideas = await getIdeas(filters);
    const [games, scriptIds, linkedByIdea] = await Promise.all([
      getGamesById(),
      getIdeaIdsWithScripts(),
      getScheduledEventsForIdeas(ideas.map((idea) => idea.id)),
    ]);

    return ok({
      count: ideas.length,
      ideas: ideas.map((idea) =>
        serializeIdeaSummary(
          idea,
          games,
          linkedByIdea.get(idea.id) ?? [],
          scriptIds.has(idea.id)
        )
      ),
    });
  }
);

const getIdea = defineTool(
  "get_idea",
  {
    title: "Get an idea",
    description:
      "Everything about one idea: fields, game, release slot, its full Markdown script, its publish checklist, and every calendar event it's linked to.",
    inputSchema: z.object({ ideaId: idParam }),
    annotations: { readOnlyHint: true },
  },
  async ({ ideaId }) => {
    const found = await getIdeaWithScript(ideaId);
    if (!found) return fail("That idea no longer exists.");

    const [games, checklist, linkedByIdea] = await Promise.all([
      getGamesById(),
      getIdeaChecklistItems(ideaId),
      getScheduledEventsForIdeas([ideaId]),
    ]);
    const linked = linkedByIdea.get(ideaId) ?? [];

    return ok({
      ...serializeIdeaSummary(
        found.idea,
        games,
        linked,
        Boolean(found.script?.content)
      ),
      script: found.script
        ? {
            content: found.script.content,
            updatedAt: found.script.updatedAt.toISOString(),
          }
        : null,
      checklist: checklist.map((item) => ({
        id: item.id,
        label: item.label,
        done: item.done,
        position: item.position,
      })),
      linkedEvents: linked.map((event) => ({
        id: event.id,
        title: event.title,
        isRelease: event.id === found.idea.releaseEventId,
        ...serializeSlot(event),
      })),
    });
  }
);

const createIdea = defineTool(
  "create_idea",
  {
    title: "Capture an idea",
    description:
      "Captures a new idea. Only the title is required. Giving a release date puts it on the calendar immediately — omit the time and it lands at 19:00, the channel's standard publish slot.",
    inputSchema: z.object({
      title: z.string(),
      description: z.string().optional(),
      format: ideaFormatParam.optional().describe("Defaults to `either`."),
      tags: tagsParam.optional(),
      gameId: idParam
        .optional()
        .describe(
          "A game's id from `list_games`. An unknown id means no game."
        ),
      script: z
        .string()
        .optional()
        .describe("An inline first draft, Markdown."),
      releaseDate: dateParam.optional(),
      releaseTime: timeParam.optional().describe("Defaults to 19:00."),
    }),
  },
  async (args) => {
    const result = await createIdeaCore({
      title: args.title,
      description: args.description,
      format: args.format,
      tags: tagsToRaw(args.tags),
      gameId: args.gameId,
      script: args.script,
      releaseDate: args.releaseDate,
      releaseTime: args.releaseTime,
    });
    return fromCoreResult(result, { ideaId: result.ideaId });
  }
);

const updateIdea = defineTool(
  "update_idea",
  {
    title: "Edit an idea",
    description:
      "Rewrites an idea's fields. This is a full replace, not a patch: every omitted field is cleared, so read the idea with `get_idea` first and send back what you want to keep. Omitting `releaseDate` unschedules the release and deletes its calendar event — use `schedule_idea_release` to move a release without touching anything else.",
    inputSchema: z.object({
      ideaId: idParam,
      title: z.string(),
      description: z.string().optional(),
      format: ideaFormatParam.optional(),
      tags: tagsParam.optional(),
      gameId: idParam.optional(),
      releaseDate: dateParam.optional(),
      releaseTime: timeParam.optional(),
    }),
  },
  async ({ ideaId, ...fields }) => {
    const result = await updateIdeaCore(ideaId, {
      title: fields.title,
      description: fields.description,
      format: fields.format,
      tags: tagsToRaw(fields.tags),
      gameId: fields.gameId,
      releaseDate: fields.releaseDate,
      releaseTime: fields.releaseTime,
    });
    return fromCoreResult(result, { ideaId });
  }
);

const setIdeaStatus = defineTool(
  "set_idea_status",
  {
    title: "Move an idea down the pipeline",
    description:
      "Sets an idea's pipeline stage. Moving into `recorded`/`edited`/`published` seeds the publish checklist's defaults the first time. Publishing reports how many checklist items are still unticked — a nudge, never a block.",
    inputSchema: z.object({ ideaId: idParam, status: ideaStatusParam }),
    annotations: { idempotentHint: true },
  },
  async ({ ideaId, status }) => {
    const result = await updateIdeaStatusCore(ideaId, status);
    return fromCoreResult(result, {
      ideaId,
      status,
      uncheckedChecklistItems: result.uncheckedCount ?? null,
    });
  }
);

const scheduleIdeaRelease = defineTool(
  "schedule_idea_release",
  {
    title: "Set or move an idea's release",
    description:
      "Sets the idea's release day/time, creating its calendar event if it has none and moving it if it does. Omitting the time uses 19:00. Nothing else about the idea is touched.",
    inputSchema: z.object({
      ideaId: idParam,
      releaseDate: dateParam,
      releaseTime: timeParam.optional().describe("Defaults to 19:00."),
    }),
    annotations: { idempotentHint: true },
  },
  async ({ ideaId, releaseDate, releaseTime }) => {
    const result = await setIdeaReleaseCore(ideaId, releaseDate, releaseTime);
    return fromCoreResult(result, {
      ideaId,
      releaseDate,
      releaseTime: releaseTime ?? "19:00",
    });
  }
);

const clearIdeaRelease = defineTool(
  "clear_idea_release",
  {
    title: "Unschedule an idea's release",
    description:
      "Removes the idea's release slot and deletes the calendar event behind it (in Google Calendar too). The idea itself, its script and its checklist are untouched. Clearing an already-unscheduled idea succeeds and does nothing.",
    inputSchema: z.object({ ideaId: idParam }),
    annotations: { idempotentHint: true, destructiveHint: true },
  },
  async ({ ideaId }) => {
    const result = await clearIdeaReleaseCore(ideaId);
    return fromCoreResult(result, { ideaId, release: null });
  }
);

const deleteIdea = defineTool(
  "delete_idea",
  {
    title: "Delete an idea",
    description:
      "Permanently deletes an idea, its script, its publish checklist, its event links and its release event. There is no undo and no archive — confirm with the user first.",
    inputSchema: z.object({ ideaId: idParam }),
    annotations: { destructiveHint: true, idempotentHint: true },
  },
  async ({ ideaId }) => {
    const result = await deleteIdeaCore(ideaId);
    return fromCoreResult(result, { ideaId, deleted: true });
  }
);

const listTags = defineTool(
  "list_tags",
  {
    title: "List tags in use",
    description:
      "Every distinct tag across all ideas, alphabetically. Read this before tagging so you reuse an existing hashtag instead of inventing a near-duplicate.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  },
  async () => ok({ tags: await getDistinctIdeaTags() })
);

export const ideaTools: McpToolDefinition[] = [
  listIdeas,
  getIdea,
  createIdea,
  updateIdea,
  setIdeaStatus,
  scheduleIdeaRelease,
  clearIdeaRelease,
  deleteIdea,
  listTags,
];
