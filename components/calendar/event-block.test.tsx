import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CalendarEvent } from "@/lib/calendar/types";
import { parseAppDate, parseAppDateTime } from "@/lib/time";

import { EventBlock } from "./event-block";

/**
 * Runs under `TZ=UTC` (vitest.config.ts) while the app zone is Europe/Madrid,
 * so fixtures are built in the app zone — `at("2026-07-08", "09:00")`
 * would render as "11:00" here and the label assertions would be testing the
 * process timezone rather than the component (issue #95).
 */

/** The instant of a wall-clock time in the app zone. */
function at(date: string, time: string): Date {
  const parsed = parseAppDateTime(date, time);
  if (!parsed) throw new Error(`bad test fixture: ${date} ${time}`);
  return parsed;
}

/** App-zone midnight for a `yyyy-MM-dd` day. */
function day(value: string): Date {
  const parsed = parseAppDate(value);
  if (!parsed) throw new Error(`bad test fixture: ${value}`);
  return parsed;
}

function pointerEvent(
  type: string,
  init: { clientX: number; clientY: number; pointerId?: number }
) {
  return new window.PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: init.pointerId ?? 1,
    pointerType: "mouse",
    clientX: init.clientX,
    clientY: init.clientY,
  });
}

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "1",
    track: "work",
    title: "Sprint planning",
    description: null,
    startsAt: at("2026-07-08", "09:00"),
    endsAt: at("2026-07-08", "10:30"),
    allDay: false,
    conflictNote: null,
    linkedIdeas: [],
    streamId: null,
    ...overrides,
  };
}

describe("EventBlock", () => {
  it("renders the track icon, label, title, and time range", () => {
    const event = makeEvent();
    render(
      <EventBlock
        segment={{ event, start: event.startsAt, end: event.endsAt }}
        style={{}}
      />
    );

    expect(screen.getByText("Sprint planning")).toBeInTheDocument();
    expect(screen.getByText("Work:")).toBeInTheDocument();
    expect(screen.getByText("09:00–10:30")).toBeInTheDocument();
  });

  it("applies content track surface classes", () => {
    const event = makeEvent({ track: "content", title: "Record voiceover" });
    render(
      <EventBlock
        segment={{ event, start: event.startsAt, end: event.endsAt }}
        style={{}}
      />
    );

    const block = screen
      .getByText("Record voiceover")
      .closest("button.absolute");
    expect(block).toHaveClass("bg-track-content");
    expect(block).toHaveClass("border-track-content-border");
  });

  it("applies stream track surface classes to a scheduled session", () => {
    const event = makeEvent({
      track: "content",
      title: "Ranked run",
      streamId: "stream-1",
    });
    render(
      <EventBlock
        segment={{ event, start: event.startsAt, end: event.endsAt }}
        style={{}}
      />
    );

    expect(screen.getByText("Stream:")).toBeInTheDocument();
    const block = screen.getByText("Ranked run").closest("button.absolute");
    expect(block).toHaveClass("bg-track-stream");
    expect(block).toHaveClass("border-track-stream-border");
    expect(block).not.toHaveClass("bg-track-content");
  });

  it("shows the clamped segment times, not the event's full span", () => {
    const event = makeEvent({
      startsAt: at("2026-07-08", "22:00"),
      endsAt: at("2026-07-09", "02:00"),
    });
    render(
      <EventBlock
        segment={{
          event,
          start: event.startsAt,
          end: at("2026-07-08", "23:59"),
        }}
        style={{}}
      />
    );

    expect(screen.getByText("22:00–23:59")).toBeInTheDocument();
  });
});

describe("EventBlock — drag/resize", () => {
  it("opens the editor on a plain click when no drag occurs", () => {
    const event = makeEvent();
    const onReschedule = vi.fn();
    render(
      <EventBlock
        segment={{ event, start: event.startsAt, end: event.endsAt }}
        style={{ top: "0%", height: "10%" }}
        day={day("2026-07-08")}
        onReschedule={onReschedule}
      />
    );

    const block = screen.getByText("Sprint planning").closest("button")!;
    fireEvent.click(block);
    expect(screen.getByText("Edit event")).toBeInTheDocument();
  });

  it("commits a vertical move as a time-only shift via onReschedule", () => {
    const event = makeEvent();
    const onReschedule = vi.fn();
    render(
      <EventBlock
        segment={{ event, start: event.startsAt, end: event.endsAt }}
        style={{ top: "0%", height: "10%" }}
        day={day("2026-07-08")}
        onReschedule={onReschedule}
      />
    );

    const block = screen.getByText("Sprint planning").closest("button")!;
    fireDrag(block, { fromX: 0, fromY: 0, toX: 0, toY: 64 });

    expect(onReschedule).toHaveBeenCalledTimes(1);
    const shift = onReschedule.mock.calls[0][0];
    // The event is 90 min long (09:00–10:30); moving preserves duration.
    expect(shift.startsAt).toEqual(at("2026-07-08", "10:00"));
    expect(shift.endsAt).toEqual(at("2026-07-08", "11:30"));
  });

  it("does not reopen the editor via the click that follows a committed drag", () => {
    const event = makeEvent();
    const onReschedule = vi.fn();
    render(
      <EventBlock
        segment={{ event, start: event.startsAt, end: event.endsAt }}
        style={{ top: "0%", height: "10%" }}
        day={day("2026-07-08")}
        onReschedule={onReschedule}
      />
    );

    const block = screen.getByText("Sprint planning").closest("button")!;
    fireDrag(block, { fromX: 0, fromY: 0, toX: 0, toY: 64 });
    fireEvent.click(block);

    expect(screen.queryByText("Edit event")).not.toBeInTheDocument();
  });

  it("does not attempt a drag when onReschedule is absent", () => {
    const event = makeEvent();
    render(
      <EventBlock
        segment={{ event, start: event.startsAt, end: event.endsAt }}
        style={{ top: "0%", height: "10%" }}
      />
    );

    const block = screen.getByText("Sprint planning").closest("button")!;
    fireDrag(block, { fromX: 0, fromY: 0, toX: 0, toY: 64 });
    fireEvent.click(block);

    expect(screen.getByText("Edit event")).toBeInTheDocument();
  });

  it("shows a resize handle only on an edge that matches the event's real boundary", () => {
    const event = makeEvent({
      startsAt: at("2026-07-08", "22:00"),
      endsAt: at("2026-07-09", "02:00"),
    });
    render(
      <EventBlock
        segment={{
          event,
          start: event.startsAt,
          end: at("2026-07-08", "23:59"),
        }}
        style={{ top: "0%", height: "10%" }}
        day={day("2026-07-08")}
        onReschedule={vi.fn()}
      />
    );

    const block = screen.getByText(event.title).closest("button")!;
    expect(
      block.querySelector('[data-slot="resize-start-handle"]')
    ).toBeInTheDocument();
    expect(
      block.querySelector('[data-slot="resize-end-handle"]')
    ).not.toBeInTheDocument();
  });

  it("commits a bottom-edge resize as an end-time-only shift", () => {
    const event = makeEvent();
    const onReschedule = vi.fn();
    render(
      <EventBlock
        segment={{ event, start: event.startsAt, end: event.endsAt }}
        style={{ top: "0%", height: "10%" }}
        day={day("2026-07-08")}
        onReschedule={onReschedule}
      />
    );

    const handle = document.querySelector(
      '[data-slot="resize-end-handle"]'
    ) as HTMLElement;
    fireDrag(handle, { fromX: 0, fromY: 0, toX: 0, toY: 32 });

    expect(onReschedule).toHaveBeenCalledTimes(1);
    const shift = onReschedule.mock.calls[0][0];
    expect(shift.startsAt).toEqual(event.startsAt);
    expect(shift.endsAt).toEqual(at("2026-07-08", "11:00"));
  });
});

function fireDrag(
  el: HTMLElement,
  {
    fromX,
    fromY,
    toX,
    toY,
  }: { fromX: number; fromY: number; toX: number; toY: number }
) {
  el.dispatchEvent(
    new window.PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "mouse",
      clientX: fromX,
      clientY: fromY,
    })
  );
  act(() => {
    window.dispatchEvent(
      pointerEvent("pointermove", { clientX: toX, clientY: toY })
    );
    window.dispatchEvent(
      pointerEvent("pointerup", { clientX: toX, clientY: toY })
    );
  });
}
