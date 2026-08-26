// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/calendar/core", () => ({
  createEventCore: vi.fn(),
  rescheduleEventCore: vi.fn(),
  deleteEventCore: vi.fn(),
}));
vi.mock("@/lib/data/events", () => ({
  getEventById: vi.fn(),
  getEventsInRange: vi.fn(),
}));

import {
  createEventCore,
  deleteEventCore,
  rescheduleEventCore,
} from "@/lib/calendar/core";
import { getEventById, getEventsInRange } from "@/lib/data/events";

import { eventTools } from "./events";
import { callTool, payloadOf } from "./test-support";

function calendarEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    track: "content" as const,
    title: "Record PoE run",
    description: null,
    startsAt: new Date("2026-08-03T08:00:00.000Z"),
    endsAt: new Date("2026-08-03T10:00:00.000Z"),
    allDay: false,
    conflictNote: null,
    linkedIdeas: [],
    streamId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("list_content_events", () => {
  it("asks for the range with an inclusive end day", async () => {
    vi.mocked(getEventsInRange).mockResolvedValue([]);
    await callTool(eventTools, "list_content_events", {
      from: "2026-08-03",
      to: "2026-08-03",
    });

    const [from, to] = vi.mocked(getEventsInRange).mock.calls[0];
    // Midnight Madrid on the 3rd is 22:00Z on the 2nd (CEST) — the whole day
    // is covered, which a naive UTC parse would have got wrong (issue #95).
    expect(from.toISOString()).toBe("2026-08-02T22:00:00.000Z");
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  // The two-worlds separation applies to machines too — this is the read half.
  it("never returns work-track events", async () => {
    vi.mocked(getEventsInRange).mockResolvedValue([
      calendarEvent(),
      calendarEvent({
        id: "evt-work",
        track: "work",
        title: "Sprint planning",
      }),
    ]);
    const body = payloadOf(
      await callTool(eventTools, "list_content_events", {
        from: "2026-08-01",
        to: "2026-08-07",
      })
    );
    expect(body.count).toBe(1);
    expect(body.events.map((event: { id: string }) => event.id)).toEqual([
      "evt-1",
    ]);
  });

  it("marks an event with a session behind it as a stream block", async () => {
    vi.mocked(getEventsInRange).mockResolvedValue([
      calendarEvent({ streamId: "stream-1" }),
    ]);
    const body = payloadOf(
      await callTool(eventTools, "list_content_events", {
        from: "2026-08-01",
        to: "2026-08-07",
      })
    );
    expect(body.events[0]).toMatchObject({
      kind: "stream",
      streamId: "stream-1",
    });
  });

  it("rejects a range that ends before it starts", async () => {
    const result = await callTool(eventTools, "list_content_events", {
      from: "2026-08-07",
      to: "2026-08-01",
    });
    expect(result.isError).toBe(true);
    expect(getEventsInRange).not.toHaveBeenCalled();
  });

  it("rejects a well-formed but nonexistent day", async () => {
    const result = await callTool(eventTools, "list_content_events", {
      from: "2026-02-30",
      to: "2026-03-01",
    });
    expect(result.isError).toBe(true);
    expect(payloadOf(result).fieldErrors).toHaveProperty("from");
  });
});

describe("create_content_event", () => {
  it("always writes to the content track, deriving the end day from the single date", async () => {
    vi.mocked(createEventCore).mockResolvedValue({
      success: true,
      eventId: "evt-new",
    });
    const body = payloadOf(
      await callTool(eventTools, "create_content_event", {
        title: "Record PoE run",
        date: "2026-08-03",
        startTime: "10:00",
        endTime: "12:00",
      })
    );
    expect(createEventCore).toHaveBeenCalledWith(
      expect.objectContaining({
        track: "content",
        startDate: "2026-08-03",
        // Derived, never taken from the caller: the tool exposes no `endDate`
        // at all now, so a multi-day content block can't be asked for (#115).
        endDate: "2026-08-03",
      })
    );
    expect(body).toEqual({ eventId: "evt-new" });
  });

  it("surfaces the event schema's field errors", async () => {
    vi.mocked(createEventCore).mockResolvedValue({
      error: "Check the highlighted fields.",
      fieldErrors: { endDate: ["End must be after start"] },
    });
    const result = await callTool(eventTools, "create_content_event", {
      title: "Backwards",
      date: "2026-08-03",
      startTime: "12:00",
      endTime: "10:00",
    });
    expect(result.isError).toBe(true);
    expect(payloadOf(result).fieldErrors).toEqual({
      endDate: ["End must be after start"],
    });
  });
});

describe("reschedule_content_event", () => {
  it("moves a content event to the new wall-clock slot", async () => {
    vi.mocked(getEventById).mockResolvedValue(calendarEvent());
    vi.mocked(rescheduleEventCore).mockResolvedValue({});

    const body = payloadOf(
      await callTool(eventTools, "reschedule_content_event", {
        eventId: "evt-1",
        date: "2026-08-07",
        startTime: "19:00",
        endTime: "21:00",
      })
    );

    const [, startsAt, endsAt] = vi.mocked(rescheduleEventCore).mock.calls[0];
    expect(startsAt.toISOString()).toBe("2026-08-07T17:00:00.000Z");
    expect(endsAt.toISOString()).toBe("2026-08-07T19:00:00.000Z");
    expect(body.startsAt).toEqual({
      at: "2026-08-07T17:00:00.000Z",
      date: "2026-08-07",
      time: "19:00",
    });
  });

  // The work-track denial, on the write half.
  it("refuses a work-track event before writing anything", async () => {
    vi.mocked(getEventById).mockResolvedValue(
      calendarEvent({ track: "work", title: "Sprint planning" })
    );
    const result = await callTool(eventTools, "reschedule_content_event", {
      eventId: "evt-work",
      date: "2026-08-07",
      startTime: "19:00",
      endTime: "21:00",
    });
    expect(result.isError).toBe(true);
    expect(payloadOf(result).message).toContain("work track");
    expect(rescheduleEventCore).not.toHaveBeenCalled();
  });

  it("fails on an event that no longer exists", async () => {
    vi.mocked(getEventById).mockResolvedValue(null);
    const result = await callTool(eventTools, "reschedule_content_event", {
      eventId: "gone",
      date: "2026-08-07",
      startTime: "19:00",
      endTime: "21:00",
    });
    expect(result.isError).toBe(true);
    expect(rescheduleEventCore).not.toHaveBeenCalled();
  });

  it("requires both times unless the event is all-day", async () => {
    vi.mocked(getEventById).mockResolvedValue(calendarEvent());
    const result = await callTool(eventTools, "reschedule_content_event", {
      eventId: "evt-1",
      date: "2026-08-07",
      startTime: "19:00",
    });
    expect(result.isError).toBe(true);
    expect(payloadOf(result).fieldErrors).toHaveProperty("endTime");
    expect(rescheduleEventCore).not.toHaveBeenCalled();
  });

  it("keeps an all-day event all-day, with no times needed", async () => {
    vi.mocked(getEventById).mockResolvedValue(calendarEvent({ allDay: true }));
    vi.mocked(rescheduleEventCore).mockResolvedValue({});
    await callTool(eventTools, "reschedule_content_event", {
      eventId: "evt-1",
      date: "2026-08-07",
    });
    const [, startsAt, endsAt] = vi.mocked(rescheduleEventCore).mock.calls[0];
    // A single-day all-day event stores startsAt === endsAt (docs/calendar.md).
    expect(startsAt.toISOString()).toBe(endsAt.toISOString());
  });

  it("rejects an end before the start", async () => {
    vi.mocked(getEventById).mockResolvedValue(calendarEvent());
    const result = await callTool(eventTools, "reschedule_content_event", {
      eventId: "evt-1",
      date: "2026-08-07",
      startTime: "21:00",
      endTime: "19:00",
    });
    expect(result.isError).toBe(true);
    expect(rescheduleEventCore).not.toHaveBeenCalled();
  });
});

describe("delete_content_event", () => {
  it("deletes a content event", async () => {
    vi.mocked(getEventById).mockResolvedValue(calendarEvent());
    vi.mocked(deleteEventCore).mockResolvedValue({});
    const body = payloadOf(
      await callTool(eventTools, "delete_content_event", { eventId: "evt-1" })
    );
    expect(body).toEqual({ eventId: "evt-1", deleted: true });
  });

  it("refuses to delete a work-track event", async () => {
    vi.mocked(getEventById).mockResolvedValue(calendarEvent({ track: "work" }));
    const result = await callTool(eventTools, "delete_content_event", {
      eventId: "evt-work",
    });
    expect(result.isError).toBe(true);
    expect(deleteEventCore).not.toHaveBeenCalled();
  });
});
