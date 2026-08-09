import "server-only";

import { z } from "zod";

import {
  createEventCore,
  deleteEventCore,
  rescheduleEventCore,
} from "@/lib/calendar/core";
import { getEventById, getEventsInRange } from "@/lib/data/events";
import { parseAppDate, parseAppDateTime } from "@/lib/time";

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
 * Calendar tools — **content track only** (issue #109).
 *
 * The two-worlds separation applies to machines too: work-life events (tasks,
 * meetings, daily logs) are invisible and untouchable here. Reads filter to
 * `track = "content"`; writes create content events outright and re-read any id
 * they're given, refusing it if it resolves to a work event. That check happens
 * before the mutation, so no MCP call can read, move or delete work.
 *
 * Note what `create_content_event` deliberately *cannot* do: make a Stream
 * block. A purple block is a content event with a session behind it, and
 * sessions come only from `create_stream`/`schedule_stream` — which is what
 * keeps "never a stream block without a session" true through this door too.
 */

const CONTENT_TRACK_ONLY =
  "That event is on the work track, which isn't reachable through MCP.";

/** The one work-track gate every event write passes. */
async function requireContentEvent(eventId: string) {
  const event = await getEventById(eventId);
  if (!event) return { error: "That event no longer exists." as const };
  if (event.track !== "content") return { error: CONTENT_TRACK_ONLY };
  return { event };
}

const listContentEvents = defineTool(
  "list_content_events",
  {
    title: "List content calendar events",
    description:
      "Content-track calendar events overlapping a date range, chronological — releases, stream blocks and plain content blocks. Work-track events are never returned. `streamId` being set means the block is a live-stream session; `linkedIdeas` lists the ideas attached to it.",
    inputSchema: z.object({
      from: dateParam.describe("First day of the range, inclusive."),
      to: dateParam.describe("Last day of the range, inclusive."),
    }),
    annotations: { readOnlyHint: true },
  },
  async ({ from, to }) => {
    const start = parseAppDate(from);
    const end = parseAppDate(to);
    if (!start || !end) {
      return fail("Pick a real day for both ends of the range.", {
        from: start ? undefined : ["Not a real date."],
        to: end ? undefined : ["Not a real date."],
      });
    }
    if (end.getTime() < start.getTime()) {
      return fail("`to` must not be before `from`.", {
        to: ["The range ends before it starts."],
      });
    }

    // `to` is inclusive for the caller; `getEventsInRange` takes a half-open
    // range, so push the boundary to the start of the next day.
    const rangeEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    const events = await getEventsInRange(start, rangeEnd);
    const content = events.filter((event) => event.track === "content");

    return ok({
      count: content.length,
      events: content.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        kind: event.streamId ? "stream" : "content",
        streamId: event.streamId,
        linkedIdeas: event.linkedIdeas.map((idea) => ({
          id: idea.id,
          title: idea.title,
          status: idea.status,
        })),
        ...serializeSlot(event),
      })),
    });
  }
);

const createContentEvent = defineTool(
  "create_content_event",
  {
    title: "Create a content calendar event",
    description:
      "Creates a plain content-track block on the calendar and syncs it to Google Calendar. It cannot create a work-track event, and it cannot create a Stream block — use `create_stream`/`schedule_stream` for a session, so a purple block always has a real one behind it.",
    inputSchema: z.object({
      title: z.string(),
      description: z.string().optional(),
      startDate: dateParam,
      startTime: timeParam
        .optional()
        .describe("Required unless `allDay` is true."),
      endDate: dateParam
        .optional()
        .describe("Defaults to `startDate` — same-day blocks are the norm."),
      endTime: timeParam
        .optional()
        .describe("Required unless `allDay` is true."),
      allDay: z.boolean().optional(),
    }),
  },
  async (args) => {
    const result = await createEventCore({
      title: args.title,
      track: "content",
      description: args.description,
      allDay: args.allDay ?? false,
      startDate: args.startDate,
      startTime: args.startTime,
      endDate: args.endDate ?? args.startDate,
      endTime: args.endTime,
    });
    return fromCoreResult(result, { eventId: result.eventId });
  }
);

const rescheduleContentEvent = defineTool(
  "reschedule_content_event",
  {
    title: "Move a content calendar event",
    description:
      "Moves a content-track event to a new slot and nothing else — title, description and any stream or idea attached to it are untouched. Refuses work-track events.",
    inputSchema: z.object({
      eventId: idParam,
      startDate: dateParam,
      startTime: timeParam
        .optional()
        .describe("Required unless `allDay` is true."),
      endDate: dateParam.optional().describe("Defaults to `startDate`."),
      endTime: timeParam
        .optional()
        .describe("Required unless `allDay` is true."),
      allDay: z
        .boolean()
        .optional()
        .describe("Defaults to the event's current all-day setting."),
    }),
  },
  async (args) => {
    const guard = await requireContentEvent(args.eventId);
    if (guard.error) return fail(guard.error);

    const allDay = args.allDay ?? guard.event!.allDay;
    const endDate = args.endDate ?? args.startDate;

    const startsAt = allDay
      ? parseAppDate(args.startDate)
      : args.startTime
        ? parseAppDateTime(args.startDate, args.startTime)
        : null;
    const endsAt = allDay
      ? parseAppDate(endDate)
      : args.endTime
        ? parseAppDateTime(endDate, args.endTime)
        : null;

    if (!startsAt || !endsAt) {
      return fail(
        allDay
          ? "Pick a real day for the start and end."
          : "A timed event needs both a start time and an end time.",
        {
          startTime: startsAt ? undefined : ["Missing or not a real start."],
          endTime: endsAt ? undefined : ["Missing or not a real end."],
        }
      );
    }
    if (endsAt.getTime() < startsAt.getTime()) {
      return fail("End must be after start.", {
        endTime: ["The event ends before it starts."],
      });
    }

    const result = await rescheduleEventCore(args.eventId, startsAt, endsAt);
    return fromCoreResult(result, {
      eventId: args.eventId,
      ...serializeSlot({ startsAt, endsAt, allDay }),
    });
  }
);

const deleteContentEvent = defineTool(
  "delete_content_event",
  {
    title: "Delete a content calendar event",
    description:
      "Permanently deletes a content-track event, in Google Calendar too. If a stream was scheduled by it, the stream survives as unscheduled. Refuses work-track events. No undo; confirm with the user first.",
    inputSchema: z.object({ eventId: idParam }),
    annotations: { destructiveHint: true, idempotentHint: true },
  },
  async ({ eventId }) => {
    const guard = await requireContentEvent(eventId);
    if (guard.error) return fail(guard.error);

    const result = await deleteEventCore(eventId);
    return fromCoreResult(result, { eventId, deleted: true });
  }
);

export const eventTools: McpToolDefinition[] = [
  listContentEvents,
  createContentEvent,
  rescheduleContentEvent,
  deleteContentEvent,
];
