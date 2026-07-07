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

import { EventEditor } from "./event-editor";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    track: "work",
    title: "Sprint planning",
    description: null,
    startsAt: new Date("2026-07-08T09:00:00"),
    endsAt: new Date("2026-07-08T10:00:00"),
    allDay: false,
    ...overrides,
  };
}

describe("EventEditor — create mode", () => {
  it("disables submit until a track is chosen", async () => {
    createEvent.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EventEditor mode="create" open onOpenChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /work/i }));
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("prefills date/time fields from slot-tap defaults", () => {
    render(
      <EventEditor
        mode="create"
        open
        onOpenChange={vi.fn()}
        defaults={{
          allDay: false,
          startDate: "2026-07-08",
          startTime: "09:00",
          endDate: "2026-07-08",
          endTime: "10:00",
        }}
      />
    );

    expect(screen.getByLabelText("Start time")).toHaveValue("09:00");
    expect(screen.getByLabelText("End time")).toHaveValue("10:00");
  });

  it("prefills as all-day from day-cell defaults, hiding the time inputs", () => {
    render(
      <EventEditor
        mode="create"
        open
        onOpenChange={vi.fn()}
        defaults={{
          allDay: true,
          startDate: "2026-07-08",
          endDate: "2026-07-08",
        }}
      />
    );

    expect(screen.getByRole("switch", { name: "All day" })).toBeChecked();
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
  });
});

describe("EventEditor — edit mode", () => {
  it("prefills fields from the existing event", () => {
    render(
      <EventEditor
        mode="edit"
        event={makeEvent()}
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Title")).toHaveValue("Sprint planning");
    expect(screen.getByRole("radio", { name: /work/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("shows a delete affordance", () => {
    render(
      <EventEditor
        mode="edit"
        event={makeEvent()}
        open
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});
