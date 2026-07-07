import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CalendarEvent } from "@/lib/calendar/types";

const createEvent = vi.hoisted(() => vi.fn());
const updateEvent = vi.hoisted(() => vi.fn());
const deleteEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/calendar/actions", () => ({
  createEvent,
  updateEvent,
  deleteEvent,
}));

import { DayColumn } from "./day-column";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "1",
    track: "work",
    title: "Sprint planning",
    description: null,
    startsAt: new Date("2026-07-08T09:00:00"),
    endsAt: new Date("2026-07-08T10:00:00"),
    allDay: false,
    ...overrides,
  };
}

describe("DayColumn", () => {
  it("renders a date-specific hour slot button for every hour of the day", () => {
    render(
      <DayColumn
        day={new Date("2026-07-08")}
        events={[]}
        now={new Date("2026-07-08")}
      />
    );
    expect(
      screen.getByRole("button", { name: "Add event at 9:00 on July 8, 2026" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add event at 23:00 on July 8, 2026" })
    ).toBeInTheDocument();
  });

  it("opens a prefilled create dialog when an empty slot is tapped", async () => {
    const user = userEvent.setup();
    render(
      <DayColumn
        day={new Date("2026-07-08")}
        events={[]}
        now={new Date("2026-07-08")}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Add event at 14:00 on July 8, 2026" })
    );

    expect(
      screen.getByRole("dialog", { name: "New event" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Start time")).toHaveValue("14:00");
    expect(screen.getByLabelText("End time")).toHaveValue("15:00");
  });

  it("tapping an existing event opens its own edit dialog, not the slot's create dialog", async () => {
    const user = userEvent.setup();
    const event = makeEvent();
    render(
      <DayColumn
        day={new Date("2026-07-08")}
        events={[event]}
        now={new Date("2026-07-08")}
      />
    );

    await user.click(screen.getByText("Sprint planning"));

    expect(
      screen.getByRole("dialog", { name: "Edit event" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "New event" })
    ).not.toBeInTheDocument();
  });
});
