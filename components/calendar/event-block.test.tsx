import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "@/lib/calendar/types";

import { EventBlock } from "./event-block";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "1",
    track: "work",
    title: "Sprint planning",
    description: null,
    startsAt: new Date("2026-07-08T09:00:00"),
    endsAt: new Date("2026-07-08T10:30:00"),
    allDay: false,
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

    const block = screen.getByText("Record voiceover").closest("div.absolute");
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
