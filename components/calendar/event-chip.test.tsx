import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CalendarEvent } from "@/lib/calendar/types";

import { EventChip } from "./event-chip";

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

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "1",
    track: "work",
    title: "Sprint planning",
    description: null,
    startsAt: new Date("2026-07-08T09:00:00"),
    endsAt: new Date("2026-07-08T10:00:00"),
    allDay: false,
    conflictNote: null,
    linkedIdeas: [],
    ...overrides,
  };
}

describe("EventChip", () => {
  it("renders the work track with its icon, label, and surface classes", () => {
    render(<EventChip event={makeEvent({ track: "work" })} />);

    expect(screen.getByText("Sprint planning")).toBeInTheDocument();
    expect(screen.getByText("Work:")).toBeInTheDocument();
    const chip = screen.getByText("Sprint planning").closest("button");
    expect(chip).toHaveClass("bg-track-work");
    expect(chip).toHaveClass("border-track-work-border");
    expect(chip?.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the content track with its icon, label, and surface classes", () => {
    render(
      <EventChip
        event={makeEvent({ track: "content", title: "Record voiceover" })}
      />
    );

    expect(screen.getByText("Record voiceover")).toBeInTheDocument();
    expect(screen.getByText("Content:")).toBeInTheDocument();
    const chip = screen.getByText("Record voiceover").closest("button");
    expect(chip).toHaveClass("bg-track-content");
    expect(chip).toHaveClass("border-track-content-border");
  });

  it("truncates long titles without breaking layout", () => {
    render(<EventChip event={makeEvent({ title: "A".repeat(200) })} />);
    expect(screen.getByText("A".repeat(200))).toHaveClass("truncate");
  });
});

describe("EventChip — cross-day drag", () => {
  it("opens the editor on a plain click when no drag occurs", () => {
    const event = makeEvent();
    render(
      <div data-slot="month-cell">
        <EventChip event={event} onReschedule={vi.fn()} />
      </div>
    );

    const chip = screen.getByText("Sprint planning").closest("button")!;
    fireEvent.click(chip);
    expect(screen.getByText("Edit event")).toBeInTheDocument();
  });

  it("commits a whole-day shift across cells via onReschedule", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 100,
      height: 80,
      top: 0,
      left: 0,
      right: 100,
      bottom: 80,
      x: 0,
      y: 0,
      toJSON() {},
    });

    const event = makeEvent();
    const onReschedule = vi.fn();
    render(
      <div data-slot="month-cell">
        <EventChip event={event} onReschedule={onReschedule} />
      </div>
    );

    const chip = screen.getByText("Sprint planning").closest("button")!;
    // 3 columns right (dx=250/100≈3), 2 rows down (dy=160/80=2) → 2*7+3 = 17 days.
    fireDrag(chip, { fromX: 0, fromY: 0, toX: 250, toY: 160 });

    expect(onReschedule).toHaveBeenCalledTimes(1);
    const shift = onReschedule.mock.calls[0][0];
    expect(shift.startsAt).toEqual(new Date("2026-07-25T09:00:00"));
    expect(shift.endsAt).toEqual(new Date("2026-07-25T10:00:00"));

    vi.restoreAllMocks();
  });

  it("does not reopen the editor via the click that follows a committed drag", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 100,
      height: 80,
      top: 0,
      left: 0,
      right: 100,
      bottom: 80,
      x: 0,
      y: 0,
      toJSON() {},
    });

    const event = makeEvent();
    render(
      <div data-slot="month-cell">
        <EventChip event={event} onReschedule={vi.fn()} />
      </div>
    );

    const chip = screen.getByText("Sprint planning").closest("button")!;
    fireDrag(chip, { fromX: 0, fromY: 0, toX: 250, toY: 0 });
    fireEvent.click(chip);

    expect(screen.queryByText("Edit event")).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("does not attempt a drag when onReschedule is absent", () => {
    const event = makeEvent();
    render(
      <div data-slot="month-cell">
        <EventChip event={event} />
      </div>
    );

    const chip = screen.getByText("Sprint planning").closest("button")!;
    fireDrag(chip, { fromX: 0, fromY: 0, toX: 250, toY: 0 });
    fireEvent.click(chip);

    expect(screen.getByText("Edit event")).toBeInTheDocument();
  });
});
