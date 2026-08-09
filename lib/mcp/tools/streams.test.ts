// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/calendar/core", () => ({ createEventCore: vi.fn() }));
vi.mock("@/lib/content/core/streams", () => ({
  createStreamCore: vi.fn(),
  updateStreamDetailsCore: vi.fn(),
  deleteStreamCore: vi.fn(),
  attachEventToStreamCore: vi.fn(),
  detachEventFromStreamCore: vi.fn(),
  toggleChecklistItemCore: vi.fn(),
  addChecklistItemCore: vi.fn(),
  removeChecklistItemCore: vi.fn(),
  addTemplateItemCore: vi.fn(),
  removeTemplateItemCore: vi.fn(),
}));
vi.mock("@/lib/data/streams", () => ({
  getStreamsOverview: vi.fn(),
  getStreamWithChecklist: vi.fn(),
  getTemplateItems: vi.fn(),
  searchAttachableEvents: vi.fn(),
}));

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
import {
  getStreamWithChecklist,
  getStreamsOverview,
  getTemplateItems,
  searchAttachableEvents,
} from "@/lib/data/streams";

import { streamTools } from "./streams";
import { callTool, payloadOf } from "./test-support";

const STREAM = {
  stream: {
    id: "stream-1",
    title: "PoE league start",
    notes: "Build plan",
    retroNotes: null,
    gameId: "game-1",
    eventId: null,
    eventTrack: null,
    createdAt: new Date("2026-07-01T09:00:00.000Z"),
    updatedAt: new Date("2026-07-01T09:00:00.000Z"),
  },
  event: null,
  game: { id: "game-1", name: "Path of Exile 2" },
  checklist: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("list_streams", () => {
  it("returns the planner's three buckets with checklist progress", async () => {
    vi.mocked(getStreamsOverview).mockResolvedValue({
      upcoming: [
        {
          id: "stream-1",
          title: "PoE league start",
          retroNotes: null,
          createdAt: new Date("2026-07-01T09:00:00.000Z"),
          event: {
            id: "evt-1",
            title: "PoE league start",
            startsAt: new Date("2026-08-07T17:00:00.000Z"),
            endsAt: new Date("2026-08-07T19:00:00.000Z"),
            allDay: false,
          },
          game: { id: "game-1", name: "Path of Exile 2" },
          checklistDone: 1,
          checklistTotal: 3,
        },
      ],
      unscheduled: [],
      past: [],
    });

    const body = payloadOf(await callTool(streamTools, "list_streams"));
    expect(body.upcoming[0]).toMatchObject({
      id: "stream-1",
      checklist: { done: 1, total: 3 },
    });
    expect(body.upcoming[0].scheduled.startsAt).toEqual({
      at: "2026-08-07T17:00:00.000Z",
      date: "2026-08-07",
      time: "19:00",
    });
    expect(body.unscheduled).toEqual([]);
  });
});

describe("get_stream", () => {
  it("fails cleanly for an unknown stream", async () => {
    vi.mocked(getStreamWithChecklist).mockResolvedValue(null);
    const result = await callTool(streamTools, "get_stream", {
      streamId: "gone",
    });
    expect(result.isError).toBe(true);
  });

  it("returns notes, retro and checklist", async () => {
    vi.mocked(getStreamWithChecklist).mockResolvedValue({
      ...STREAM,
      checklist: [
        {
          id: "item-1",
          streamId: "stream-1",
          label: "Set the title",
          done: true,
          position: 0,
          createdAt: new Date("2026-07-01T09:00:00.000Z"),
          updatedAt: new Date("2026-07-01T09:00:00.000Z"),
        },
      ],
    });
    const body = payloadOf(
      await callTool(streamTools, "get_stream", { streamId: "stream-1" })
    );
    expect(body).toMatchObject({
      id: "stream-1",
      notes: "Build plan",
      retroNotes: null,
      scheduled: null,
    });
    expect(body.checklist[0]).toEqual({
      id: "item-1",
      label: "Set the title",
      done: true,
      position: 0,
    });
  });
});

describe("create_stream", () => {
  it("creates an unscheduled stream when no date is given", async () => {
    vi.mocked(createStreamCore).mockResolvedValue({
      success: true,
      streamId: "stream-new",
    });
    const body = payloadOf(
      await callTool(streamTools, "create_stream", {
        title: "PoE league start",
      })
    );
    expect(createStreamCore).toHaveBeenCalledWith(
      expect.objectContaining({ planned: false })
    );
    expect(body).toEqual({ streamId: "stream-new" });
  });

  it("plans the slot in the same call when a date is given", async () => {
    vi.mocked(createStreamCore).mockResolvedValue({
      success: true,
      streamId: "stream-new",
    });
    await callTool(streamTools, "create_stream", {
      title: "PoE league start",
      date: "2026-08-07",
      time: "19:00",
    });
    expect(createStreamCore).toHaveBeenCalledWith(
      expect.objectContaining({
        planned: true,
        date: "2026-08-07",
        time: "19:00",
      })
    );
  });

  it("surfaces the capture schema's field errors", async () => {
    vi.mocked(createStreamCore).mockResolvedValue({
      error: "Check the highlighted fields.",
      fieldErrors: { time: ["Pick a start time"] },
    });
    const result = await callTool(streamTools, "create_stream", {
      title: "PoE",
      date: "2026-08-07",
    });
    expect(result.isError).toBe(true);
    expect(payloadOf(result).fieldErrors).toEqual({
      time: ["Pick a start time"],
    });
  });
});

describe("update_stream", () => {
  it("sends every editable field in one write, blanking what was omitted", async () => {
    vi.mocked(updateStreamDetailsCore).mockResolvedValue({ success: true });
    await callTool(streamTools, "update_stream", {
      streamId: "stream-1",
      title: "PoE league start",
      retroNotes: "Went long",
    });
    expect(updateStreamDetailsCore).toHaveBeenCalledWith({
      id: "stream-1",
      title: "PoE league start",
      notes: "",
      retroNotes: "Went long",
      gameId: "",
    });
  });
});

describe("schedule_stream", () => {
  it("attaches an existing event without creating one", async () => {
    vi.mocked(getStreamWithChecklist).mockResolvedValue(STREAM);
    vi.mocked(attachEventToStreamCore).mockResolvedValue({});

    const body = payloadOf(
      await callTool(streamTools, "schedule_stream", {
        streamId: "stream-1",
        eventId: "evt-1",
      })
    );
    expect(createEventCore).not.toHaveBeenCalled();
    expect(attachEventToStreamCore).toHaveBeenCalledWith("stream-1", "evt-1");
    expect(body).toEqual({ streamId: "stream-1", eventId: "evt-1" });
  });

  it("creates a plain content event for the 2h slot, then attaches it", async () => {
    vi.mocked(getStreamWithChecklist).mockResolvedValue(STREAM);
    vi.mocked(createEventCore).mockResolvedValue({
      success: true,
      eventId: "evt-new",
    });
    vi.mocked(attachEventToStreamCore).mockResolvedValue({});

    await callTool(streamTools, "schedule_stream", {
      streamId: "stream-1",
      date: "2026-08-07",
      time: "19:00",
    });

    // A plain content event, never kind "stream": the session already exists,
    // and creating a second one would break the one-stream-per-event rule.
    expect(createEventCore).toHaveBeenCalledWith(
      expect.objectContaining({
        track: "content",
        startDate: "2026-08-07",
        startTime: "19:00",
        endDate: "2026-08-07",
        endTime: "21:00",
      })
    );
    expect(attachEventToStreamCore).toHaveBeenCalledWith("stream-1", "evt-new");
  });

  it("checks the stream exists before creating anything on the calendar", async () => {
    vi.mocked(getStreamWithChecklist).mockResolvedValue(null);
    const result = await callTool(streamTools, "schedule_stream", {
      streamId: "gone",
      date: "2026-08-07",
      time: "19:00",
    });
    expect(result.isError).toBe(true);
    expect(createEventCore).not.toHaveBeenCalled();
  });

  it("needs either an event to attach or a date to create one", async () => {
    const result = await callTool(streamTools, "schedule_stream", {
      streamId: "stream-1",
    });
    expect(result.isError).toBe(true);
    expect(getStreamWithChecklist).not.toHaveBeenCalled();
  });

  it("needs a start time for a timed slot", async () => {
    vi.mocked(getStreamWithChecklist).mockResolvedValue(STREAM);
    const result = await callTool(streamTools, "schedule_stream", {
      streamId: "stream-1",
      date: "2026-08-07",
    });
    expect(result.isError).toBe(true);
    expect(createEventCore).not.toHaveBeenCalled();
  });

  it("makes an all-day slot a single date-scoped day", async () => {
    vi.mocked(getStreamWithChecklist).mockResolvedValue(STREAM);
    vi.mocked(createEventCore).mockResolvedValue({
      success: true,
      eventId: "evt-new",
    });
    vi.mocked(attachEventToStreamCore).mockResolvedValue({});

    await callTool(streamTools, "schedule_stream", {
      streamId: "stream-1",
      date: "2026-08-07",
      allDay: true,
    });
    expect(createEventCore).toHaveBeenCalledWith(
      expect.objectContaining({
        allDay: true,
        startDate: "2026-08-07",
        endDate: "2026-08-07",
        endTime: undefined,
      })
    );
  });

  // The one-stream-per-event guarantee lives in the domain; the tool must
  // surface its refusal rather than swallowing it.
  it("surfaces an event another stream already claims", async () => {
    vi.mocked(getStreamWithChecklist).mockResolvedValue(STREAM);
    vi.mocked(attachEventToStreamCore).mockResolvedValue({
      error: "That event is already attached to another stream.",
    });
    const result = await callTool(streamTools, "schedule_stream", {
      streamId: "stream-1",
      eventId: "evt-1",
    });
    expect(result.isError).toBe(true);
    expect(payloadOf(result).message).toContain("another stream");
  });

  it("surfaces the work-track refusal when asked to attach a work event", async () => {
    vi.mocked(getStreamWithChecklist).mockResolvedValue(STREAM);
    vi.mocked(attachEventToStreamCore).mockResolvedValue({
      error: "Only content-track events can attach to a stream.",
    });
    const result = await callTool(streamTools, "schedule_stream", {
      streamId: "stream-1",
      eventId: "evt-work",
    });
    expect(result.isError).toBe(true);
  });
});

describe("unschedule_stream", () => {
  it("detaches the event and leaves it standing", async () => {
    vi.mocked(detachEventFromStreamCore).mockResolvedValue({});
    const body = payloadOf(
      await callTool(streamTools, "unschedule_stream", { streamId: "stream-1" })
    );
    expect(body).toEqual({ streamId: "stream-1", scheduled: null });
  });
});

describe("delete_stream", () => {
  it("reports the delete", async () => {
    vi.mocked(deleteStreamCore).mockResolvedValue({});
    const body = payloadOf(
      await callTool(streamTools, "delete_stream", { streamId: "stream-1" })
    );
    expect(body).toEqual({ streamId: "stream-1", deleted: true });
  });

  it("fails on a stream that's already gone", async () => {
    vi.mocked(deleteStreamCore).mockResolvedValue({
      error: "That stream no longer exists.",
    });
    const result = await callTool(streamTools, "delete_stream", {
      streamId: "gone",
    });
    expect(result.isError).toBe(true);
  });
});

describe("search_attachable_events", () => {
  it("passes an empty query through when none is given", async () => {
    vi.mocked(searchAttachableEvents).mockResolvedValue([]);
    await callTool(streamTools, "search_attachable_events");
    expect(searchAttachableEvents).toHaveBeenCalledWith("");
  });
});

describe("checklist tools", () => {
  it("ticks an item", async () => {
    vi.mocked(toggleChecklistItemCore).mockResolvedValue({});
    const body = payloadOf(
      await callTool(streamTools, "set_checklist_item", {
        streamId: "stream-1",
        itemId: "item-1",
        done: true,
      })
    );
    expect(toggleChecklistItemCore).toHaveBeenCalledWith(
      "stream-1",
      "item-1",
      true
    );
    expect(body).toMatchObject({ done: true });
  });

  it("rejects an empty label when adding", async () => {
    vi.mocked(addChecklistItemCore).mockResolvedValue({
      error: "Label is required",
    });
    const result = await callTool(streamTools, "add_checklist_item", {
      streamId: "stream-1",
      label: "   ",
    });
    expect(result.isError).toBe(true);
  });

  it("removes an item", async () => {
    vi.mocked(removeChecklistItemCore).mockResolvedValue({});
    const body = payloadOf(
      await callTool(streamTools, "remove_checklist_item", {
        streamId: "stream-1",
        itemId: "item-1",
      })
    );
    expect(body).toMatchObject({ removed: true });
  });
});

describe("checklist template tools", () => {
  it("reads the template in order", async () => {
    vi.mocked(getTemplateItems).mockResolvedValue([
      {
        id: "tpl-1",
        label: "Set the title",
        position: 0,
        createdAt: new Date("2026-07-01T09:00:00.000Z"),
        updatedAt: new Date("2026-07-01T09:00:00.000Z"),
      },
    ]);
    const body = payloadOf(
      await callTool(streamTools, "get_checklist_template")
    );
    expect(body.items).toEqual([
      { id: "tpl-1", label: "Set the title", position: 0 },
    ]);
  });

  it("appends to the template", async () => {
    vi.mocked(addTemplateItemCore).mockResolvedValue({});
    await callTool(streamTools, "add_checklist_template_item", {
      label: "Tweet the go-live",
    });
    expect(addTemplateItemCore).toHaveBeenCalledWith("Tweet the go-live");
  });

  it("removes a template item", async () => {
    vi.mocked(removeTemplateItemCore).mockResolvedValue({});
    const body = payloadOf(
      await callTool(streamTools, "remove_checklist_template_item", {
        itemId: "tpl-1",
      })
    );
    expect(body).toMatchObject({ removed: true });
  });
});
