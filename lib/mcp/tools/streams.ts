import "server-only";

import { z } from "zod";

import { createEventCore } from "@/lib/calendar/core";
import {
  addChecklistItemCore,
  addTemplateItemCore,
  attachEventToStreamCore,
  createStreamCore,
  deleteStreamCore,
  detachEventFromStreamCore,
  removeChecklistItemCore,
  removeTemplateItemCore,
  toggleChecklistItemCore,
  updateStreamDetailsCore,
} from "@/lib/content/core/streams";
import { DEFAULT_STREAM_DURATION_MS } from "@/lib/content/stream-schema";
import {
  getStreamWithChecklist,
  getStreamsOverview,
  getTemplateItems,
  searchAttachableEvents,
  type StreamSummary,
} from "@/lib/data/streams";
import {
  formatAppDateParam,
  formatAppTimeParam,
  parseAppDateTime,
} from "@/lib/time";

import { dateParam, idParam, timeParam } from "../params";
import { serializeSlot } from "../serialize";
import {
  defineTool,
  fail,
  fromCoreResult,
  ok,
  type McpToolDefinition,
} from "../tool";

/**
 * Stream-planner tools (issue #109). The invariant that matters here: a purple
 * Stream block on the calendar always has a real session behind it. `create_stream`
 * and `schedule_stream` are therefore the only ways a stream block ever comes
 * into being — `create_content_event` deliberately cannot make one.
 */

function serializeSummary(summary: StreamSummary) {
  return {
    id: summary.id,
    title: summary.title,
    game: summary.game,
    hasRetro: Boolean(summary.retroNotes),
    checklist: {
      done: summary.checklistDone,
      total: summary.checklistTotal,
    },
    scheduled: summary.event
      ? { eventId: summary.event.id, ...serializeSlot(summary.event) }
      : null,
    createdAt: summary.createdAt.toISOString(),
  };
}

const listStreams = defineTool(
  "list_streams",
  {
    title: "List streams",
    description:
      "The stream planner's three buckets: `upcoming` (soonest first), `unscheduled` (newest first) and `past` (most recent first). A stream is 'past' once its slot has started.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  },
  async () => {
    const overview = await getStreamsOverview();
    return ok({
      upcoming: overview.upcoming.map(serializeSummary),
      unscheduled: overview.unscheduled.map(serializeSummary),
      past: overview.past.map(serializeSummary),
    });
  }
);

const getStream = defineTool(
  "get_stream",
  {
    title: "Get a stream",
    description:
      "Everything about one stream: game, topic/prep notes, retro notes, its full checklist and its scheduled slot.",
    inputSchema: z.object({ streamId: idParam }),
    annotations: { readOnlyHint: true },
  },
  async ({ streamId }) => {
    const found = await getStreamWithChecklist(streamId);
    if (!found) return fail("That stream no longer exists.");

    return ok({
      id: found.stream.id,
      title: found.stream.title,
      notes: found.stream.notes,
      retroNotes: found.stream.retroNotes,
      game: found.game,
      scheduled: found.event
        ? { eventId: found.event.id, ...serializeSlot(found.event) }
        : null,
      checklist: found.checklist.map((item) => ({
        id: item.id,
        label: item.label,
        done: item.done,
        position: item.position,
      })),
      createdAt: found.stream.createdAt.toISOString(),
    });
  }
);

const createStream = defineTool(
  "create_stream",
  {
    title: "Plan a stream",
    description:
      "Creates a stream session, snapshotting the current checklist template onto it. Give a date to schedule it in the same call — a timed slot runs 2 hours from the start time — or leave the date out to park it as unscheduled and schedule it later.",
    inputSchema: z.object({
      title: z.string(),
      notes: z.string().optional().describe("Topic / prep notes."),
      gameId: idParam.optional().describe("A game's id from `list_games`."),
      date: dateParam
        .optional()
        .describe("Omit to create the stream unscheduled."),
      time: timeParam
        .optional()
        .describe("Required alongside `date` unless `allDay` is true."),
      allDay: z.boolean().optional(),
    }),
  },
  async (args) => {
    const result = await createStreamCore({
      title: args.title,
      notes: args.notes,
      gameId: args.gameId,
      planned: Boolean(args.date),
      allDay: args.allDay ?? false,
      date: args.date,
      time: args.time,
    });
    return fromCoreResult(result, { streamId: result.streamId });
  }
);

const updateStream = defineTool(
  "update_stream",
  {
    title: "Edit a stream",
    description:
      "Rewrites a stream's title, notes, retro notes and game in one write. This is a full replace, not a patch: omitted text fields are cleared, so read `get_stream` first and send back what you want to keep. The schedule is not touched — use `schedule_stream`/`unschedule_stream` for that.",
    inputSchema: z.object({
      streamId: idParam,
      title: z.string(),
      notes: z.string().optional(),
      retroNotes: z.string().optional(),
      gameId: idParam.optional(),
    }),
  },
  async ({ streamId, title, notes, retroNotes, gameId }) => {
    const result = await updateStreamDetailsCore({
      id: streamId,
      title,
      notes: notes ?? "",
      retroNotes: retroNotes ?? "",
      gameId: gameId ?? "",
    });
    return fromCoreResult(result, { streamId });
  }
);

const deleteStream = defineTool(
  "delete_stream",
  {
    title: "Delete a stream",
    description:
      "Permanently deletes a stream, its checklist, and the calendar event scheduling it (in Google Calendar too) — a block promising a session that no longer exists would be worse than no block. No undo; confirm with the user first.",
    inputSchema: z.object({ streamId: idParam }),
    annotations: { destructiveHint: true, idempotentHint: true },
  },
  async ({ streamId }) => {
    const result = await deleteStreamCore(streamId);
    return fromCoreResult(result, { streamId, deleted: true });
  }
);

/** The end of a stream's slot: the same day for all-day, otherwise the fixed 2h block. */
function streamSlotEnd(
  date: string,
  time: string | undefined,
  allDay: boolean
): { endDate: string; endTime?: string } | null {
  if (allDay) return { endDate: date };
  if (!time) return null;
  const startsAt = parseAppDateTime(date, time);
  if (!startsAt) return null;
  const endsAt = new Date(startsAt.getTime() + DEFAULT_STREAM_DURATION_MS);
  return {
    endDate: formatAppDateParam(endsAt),
    endTime: formatAppTimeParam(endsAt),
  };
}

const scheduleStream = defineTool(
  "schedule_stream",
  {
    title: "Schedule a stream",
    description:
      "Puts a stream on the calendar, turning its block purple. Either attach an existing content-track event by id (see `search_attachable_events`), or give a date and the event is created for you — timed slots run 2 hours. Work-track events are refused.",
    inputSchema: z.object({
      streamId: idParam,
      eventId: idParam
        .optional()
        .describe(
          "Attach this existing content event instead of creating one."
        ),
      date: dateParam.optional().describe("Create a new event on this day."),
      time: timeParam
        .optional()
        .describe("Required alongside `date` unless `allDay` is true."),
      allDay: z.boolean().optional(),
    }),
  },
  async ({ streamId, eventId, date, time, allDay }) => {
    if (!eventId && !date) {
      return fail(
        "Give either an `eventId` to attach or a `date` to schedule.",
        {
          date: ["Give either an eventId or a date."],
        }
      );
    }

    // Checked before anything is created, so a bad stream id can never leave a
    // stray event behind on the calendar.
    const stream = await getStreamWithChecklist(streamId);
    if (!stream) return fail("That stream no longer exists.");

    let targetEventId = eventId;
    if (!targetEventId && date) {
      const end = streamSlotEnd(date, time, allDay ?? false);
      if (!end) {
        return fail("Pick a start time, or set `allDay` to true.", {
          time: ["A timed stream needs a start time."],
        });
      }
      const created = await createEventCore({
        title: stream.stream.title,
        track: "content",
        description: stream.stream.notes ?? "",
        allDay: allDay ?? false,
        startDate: date,
        startTime: time,
        endDate: end.endDate,
        endTime: end.endTime,
      });
      if (created.error || !created.eventId) {
        return fail(
          created.error ?? "That slot isn't valid.",
          created.fieldErrors
        );
      }
      targetEventId = created.eventId;
    }

    const result = await attachEventToStreamCore(streamId, targetEventId!);
    return fromCoreResult(result, { streamId, eventId: targetEventId });
  }
);

const unscheduleStream = defineTool(
  "unschedule_stream",
  {
    title: "Unschedule a stream",
    description:
      "Detaches the stream from its calendar event, moving it back to `unscheduled`. The event itself survives as a plain content block — use `delete_content_event` if it should go too.",
    inputSchema: z.object({ streamId: idParam }),
    annotations: { idempotentHint: true },
  },
  async ({ streamId }) => {
    const result = await detachEventFromStreamCore(streamId);
    return fromCoreResult(result, { streamId, scheduled: null });
  }
);

const searchAttachable = defineTool(
  "search_attachable_events",
  {
    title: "Find events a stream can attach to",
    description:
      "Content-track events not already claimed by another stream, newest first, capped at 20. Feed a result's id to `schedule_stream`.",
    inputSchema: z.object({
      query: z.string().optional().describe("Case-insensitive title search."),
    }),
    annotations: { readOnlyHint: true },
  },
  async ({ query }) => {
    const results = await searchAttachableEvents(query ?? "");
    return ok({
      count: results.length,
      events: results.map((event) => ({
        id: event.id,
        title: event.title,
        ...serializeSlot(event),
      })),
    });
  }
);

const setChecklistItem = defineTool(
  "set_checklist_item",
  {
    title: "Tick a stream checklist item",
    description:
      "Sets one of a stream's checklist items done or not done. Idempotent — setting the same value twice succeeds and changes nothing.",
    inputSchema: z.object({
      streamId: idParam,
      itemId: idParam,
      done: z.boolean(),
    }),
    annotations: { idempotentHint: true },
  },
  async ({ streamId, itemId, done }) => {
    const result = await toggleChecklistItemCore(streamId, itemId, done);
    return fromCoreResult(result, { streamId, itemId, done });
  }
);

const addChecklistItem = defineTool(
  "add_checklist_item",
  {
    title: "Add a stream checklist item",
    description:
      "Appends an item to one stream's checklist. Local to that stream — the template is never touched.",
    inputSchema: z.object({ streamId: idParam, label: z.string() }),
  },
  async ({ streamId, label }) => {
    const result = await addChecklistItemCore(streamId, label);
    return fromCoreResult(result, { streamId, label });
  }
);

const removeChecklistItem = defineTool(
  "remove_checklist_item",
  {
    title: "Remove a stream checklist item",
    description:
      "Deletes one item from one stream's checklist. The template is never touched.",
    inputSchema: z.object({ streamId: idParam, itemId: idParam }),
    annotations: { destructiveHint: true, idempotentHint: true },
  },
  async ({ streamId, itemId }) => {
    const result = await removeChecklistItemCore(streamId, itemId);
    return fromCoreResult(result, { streamId, itemId, removed: true });
  }
);

const getChecklistTemplate = defineTool(
  "get_checklist_template",
  {
    title: "Read the stream checklist template",
    description:
      "The default checklist every new stream is created with, in order.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  },
  async () => {
    const items = await getTemplateItems();
    return ok({
      items: items.map((item) => ({
        id: item.id,
        label: item.label,
        position: item.position,
      })),
    });
  }
);

const addChecklistTemplateItem = defineTool(
  "add_checklist_template_item",
  {
    title: "Add to the stream checklist template",
    description:
      "Appends an item to the template new streams are seeded from. Copy-on-create: streams that already exist keep the checklist they were created with.",
    inputSchema: z.object({ label: z.string() }),
  },
  async ({ label }) => {
    const result = await addTemplateItemCore(label);
    return fromCoreResult(result, { label });
  }
);

const removeChecklistTemplateItem = defineTool(
  "remove_checklist_template_item",
  {
    title: "Remove from the stream checklist template",
    description:
      "Deletes an item from the template. Existing streams keep it — templates only ever apply at creation time.",
    inputSchema: z.object({ itemId: idParam }),
    annotations: { destructiveHint: true, idempotentHint: true },
  },
  async ({ itemId }) => {
    const result = await removeTemplateItemCore(itemId);
    return fromCoreResult(result, { itemId, removed: true });
  }
);

export const streamTools: McpToolDefinition[] = [
  listStreams,
  getStream,
  createStream,
  updateStream,
  deleteStream,
  scheduleStream,
  unscheduleStream,
  searchAttachable,
  setChecklistItem,
  addChecklistItem,
  removeChecklistItem,
  getChecklistTemplate,
  addChecklistTemplateItem,
  removeChecklistTemplateItem,
];
