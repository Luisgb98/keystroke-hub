import "server-only";

import { z } from "zod";

import {
  addIdeaChecklistItemCore,
  removeIdeaChecklistItemCore,
  toggleIdeaChecklistItemCore,
} from "@/lib/content/core/checklists";
import {
  linkIdeaToEventCore,
  unlinkIdeaFromEventCore,
} from "@/lib/content/core/links";
import { searchLinkableIdeas } from "@/lib/data/idea-event-links";

import { idParam } from "../params";
import {
  defineTool,
  fromCoreResult,
  ok,
  type McpToolDefinition,
} from "../tool";

/**
 * Idea↔event links and the per-idea publish checklist (issue #109).
 * `linkIdeaToEventCore` refuses work-track events, so this door can't reach
 * work either.
 */

const linkIdeaToEvent = defineTool(
  "link_idea_to_event",
  {
    title: "Link an idea to an event",
    description:
      "Attaches an idea to a content-track calendar event (a recording session, a stream block). Work-track events are refused. Linking twice is a no-op success.",
    inputSchema: z.object({ ideaId: idParam, eventId: idParam }),
    annotations: { idempotentHint: true },
  },
  async ({ ideaId, eventId }) => {
    const result = await linkIdeaToEventCore(eventId, ideaId);
    return fromCoreResult(result, { ideaId, eventId, linked: true });
  }
);

const unlinkIdeaFromEvent = defineTool(
  "unlink_idea_from_event",
  {
    title: "Unlink an idea from an event",
    description:
      "Removes the link between an idea and an event. Neither row is deleted. Unlinking something that isn't linked is a no-op success.",
    inputSchema: z.object({ ideaId: idParam, eventId: idParam }),
    annotations: { idempotentHint: true },
  },
  async ({ ideaId, eventId }) => {
    const result = await unlinkIdeaFromEventCore(eventId, ideaId);
    return fromCoreResult(result, { ideaId, eventId, linked: false });
  }
);

const searchLinkable = defineTool(
  "search_linkable_ideas",
  {
    title: "Find ideas an event can link to",
    description:
      "Ideas not already linked to the given event, newest first, capped at 20. Feed a result's id to `link_idea_to_event`.",
    inputSchema: z.object({
      eventId: idParam,
      query: z.string().optional().describe("Case-insensitive title search."),
    }),
    annotations: { readOnlyHint: true },
  },
  async ({ eventId, query }) => {
    const ideas = await searchLinkableIdeas(eventId, query ?? "");
    return ok({ count: ideas.length, ideas });
  }
);

const setIdeaChecklistItem = defineTool(
  "set_idea_checklist_item",
  {
    title: "Tick a publish checklist item",
    description:
      "Sets one of an idea's publish checklist items done or not done. Idempotent. Read the checklist with `get_idea`.",
    inputSchema: z.object({
      ideaId: idParam,
      itemId: idParam,
      done: z.boolean(),
    }),
    annotations: { idempotentHint: true },
  },
  async ({ ideaId, itemId, done }) => {
    const result = await toggleIdeaChecklistItemCore(ideaId, itemId, done);
    return fromCoreResult(result, { ideaId, itemId, done });
  }
);

const addIdeaChecklistItem = defineTool(
  "add_idea_checklist_item",
  {
    title: "Add a publish checklist item",
    description:
      "Appends an item to one idea's publish checklist. Local to that idea.",
    inputSchema: z.object({ ideaId: idParam, label: z.string() }),
  },
  async ({ ideaId, label }) => {
    const result = await addIdeaChecklistItemCore(ideaId, label);
    return fromCoreResult(result, { ideaId, label });
  }
);

const removeIdeaChecklistItem = defineTool(
  "remove_idea_checklist_item",
  {
    title: "Remove a publish checklist item",
    description: "Deletes one item from one idea's publish checklist.",
    inputSchema: z.object({ ideaId: idParam, itemId: idParam }),
    annotations: { destructiveHint: true, idempotentHint: true },
  },
  async ({ ideaId, itemId }) => {
    const result = await removeIdeaChecklistItemCore(ideaId, itemId);
    return fromCoreResult(result, { ideaId, itemId, removed: true });
  }
);

export const linkTools: McpToolDefinition[] = [
  linkIdeaToEvent,
  unlinkIdeaFromEvent,
  searchLinkable,
  setIdeaChecklistItem,
  addIdeaChecklistItem,
  removeIdeaChecklistItem,
];
