import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CalendarEvent } from "@/lib/calendar/types";

import { EventBlock } from "./event-block";

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
    startsAt: new Date("2026-07-08T09:00:00"),
    endsAt: new Date("2026-07-08T10:30:00"),
    allDay: false,
    conflictNote: null,
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

  it("shows the clamped segment times, not the event's full span", () => {
    const event = makeEvent({
      startsAt: new Date("2026-07-08T22:00:00"),
      endsAt: new Date("2026-07-09T02:00:00"),
    });
    render(
      <EventBlock
        segment={{
          event,
          start: event.startsAt,
          end: new Date("2026-07-08T23:59:00"),
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
        day={new Date("2026-07-08")}
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
        day={new Date("2026-07-08")}
        onReschedule={onReschedule}
      />
    );

    const block = screen.getByText("Sprint planning").closest("button")!;
    fireDrag(block, { fromX: 0, fromY: 0, toX: 0, toY: 64 });

    expect(onReschedule).toHaveBeenCalledTimes(1);
    const shift = onReschedule.mock.calls[0][0];
    // The event is 90 min long (09:00–10:30); moving preserves duration.
    expect(shift.startsAt).toEqual(new Date("2026-07-08T10:00:00"));
    expect(shift.endsAt).toEqual(new Date("2026-07-08T11:30:00"));
  });

  it("does not reopen the editor via the click that follows a committed drag", () => {
    const event = makeEvent();
    const onReschedule = vi.fn();
    render(
      <EventBlock
        segment={{ event, start: event.startsAt, end: event.endsAt }}
        style={{ top: "0%", height: "10%" }}
        day={new Date("2026-07-08")}
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
      startsAt: new Date("2026-07-08T22:00:00"),
      endsAt: new Date("2026-07-09T02:00:00"),
    });
    render(
      <EventBlock
        segment={{
          event,
          start: event.startsAt,
          end: new Date("2026-07-08T23:59:00"),
        }}
        style={{ top: "0%", height: "10%" }}
        day={new Date("2026-07-08")}
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
        day={new Date("2026-07-08")}
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
    expect(shift.endsAt).toEqual(new Date("2026-07-08T11:00:00"));
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
