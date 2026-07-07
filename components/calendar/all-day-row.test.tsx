import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "@/lib/calendar/types";

import { AllDayRow } from "./all-day-row";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "1",
    track: "work",
    title: "Company all-hands",
    description: null,
    startsAt: new Date("2026-07-08T00:00:00"),
    endsAt: new Date("2026-07-08T00:00:00"),
    allDay: true,
    conflictNote: null,
    ...overrides,
  };
}

describe("AllDayRow", () => {
  it("renders nothing when there are no all-day events (empty state)", () => {
    const { container } = render(
      <AllDayRow days={[new Date("2026-07-08")]} events={[]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("places an all-day event under the day it falls on", () => {
    render(
      <AllDayRow
        days={[new Date("2026-07-07"), new Date("2026-07-08")]}
        events={[makeEvent()]}
      />
    );
    expect(screen.getByText("Company all-hands")).toBeInTheDocument();
  });

  it("does not render an event under a day it doesn't span", () => {
    render(
      <AllDayRow days={[new Date("2026-07-09")]} events={[makeEvent()]} />
    );
    expect(screen.queryByText("Company all-hands")).not.toBeInTheDocument();
  });

  it("renders a multi-day event under every day it spans", () => {
    const event = makeEvent({
      title: "Conference",
      startsAt: new Date("2026-07-07T00:00:00"),
      endsAt: new Date("2026-07-09T00:00:00"),
    });
    render(
      <AllDayRow
        days={[
          new Date("2026-07-06"),
          new Date("2026-07-07"),
          new Date("2026-07-08"),
          new Date("2026-07-09"),
          new Date("2026-07-10"),
        ]}
        events={[event]}
      />
    );
    expect(screen.getAllByText("Conference")).toHaveLength(3);
  });
});
