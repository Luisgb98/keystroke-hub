import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getMonthGridDays } from "@/lib/calendar/range";
import type { CalendarEvent } from "@/lib/calendar/types";

import { MonthView } from "./month-view";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "1",
    track: "work",
    title: "Event",
    description: null,
    startsAt: new Date("2026-07-08T09:00:00"),
    endsAt: new Date("2026-07-08T10:00:00"),
    allDay: false,
    ...overrides,
  };
}

describe("MonthView", () => {
  it("renders 42 day cells linking to their day view", () => {
    const anchor = new Date("2026-07-08");
    render(
      <MonthView
        days={getMonthGridDays(anchor)}
        anchorMonth={anchor}
        events={[]}
        now={anchor}
      />
    );
    expect(screen.getAllByRole("link")).toHaveLength(42);
  });

  it("highlights today's cell", () => {
    const today = new Date("2026-07-08");
    render(
      <MonthView
        days={getMonthGridDays(today)}
        anchorMonth={today}
        events={[]}
        now={today}
      />
    );
    const todayCell = screen.getByRole("link", {
      name: "Wednesday, July 8, 2026",
    });
    expect(todayCell.querySelector("span")).toHaveClass("bg-primary");
  });

  it("collapses events beyond the per-cell max into a +n overflow chip", () => {
    const day = new Date("2026-07-08");
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent({ id: String(i), title: `Event ${i}` })
    );
    render(
      <MonthView
        days={getMonthGridDays(day)}
        anchorMonth={day}
        events={events}
        now={day}
      />
    );

    expect(screen.getByText("Event 0")).toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
    expect(screen.queryByText("Event 4")).not.toBeInTheDocument();
  });

  it("dims days that spill over from adjacent months", () => {
    const anchor = new Date("2026-07-08");
    render(
      <MonthView
        days={getMonthGridDays(anchor)}
        anchorMonth={anchor}
        events={[]}
        now={anchor}
      />
    );
    // The grid for July 2026 starts on Monday June 29.
    const spilloverCell = screen.getByRole("link", {
      name: "Monday, June 29, 2026",
    });
    expect(spilloverCell.querySelector("span")).toHaveClass(
      "text-muted-foreground"
    );
  });
});
