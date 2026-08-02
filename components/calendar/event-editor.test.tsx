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

const dismissConflictNote = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sync/actions", () => ({ dismissConflictNote }));

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
    conflictNote: null,
    linkedIdeas: [],
    streamId: null,
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

    expect(screen.getByLabelText("Start")).toHaveValue("2026-07-08");
    expect(screen.getByLabelText("Start time")).toHaveValue("09:00");
    expect(screen.getByLabelText("End")).toHaveValue("2026-07-08");
    expect(screen.getByLabelText("End time")).toHaveValue("10:00");
  });

  it("picking a start date in the calendar stores that exact day", async () => {
    const user = userEvent.setup();
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

    await user.click(
      screen.getByRole("button", { name: "Open starting day calendar" })
    );
    await user.click(
      await screen.findByRole("button", { name: "Monday, July 20th, 2026" })
    );

    // The 20th, not the 19th — a UTC round trip would lose the day.
    expect(screen.getByLabelText("Start")).toHaveValue("2026-07-20");
    expect(screen.getByLabelText("End")).toHaveValue("2026-07-08");
  });

  it("picking a start time from the list updates only that field", async () => {
    const user = userEvent.setup();
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

    await user.click(
      screen.getByRole("button", { name: "Choose starting time" })
    );
    await user.click(await screen.findByRole("option", { name: "11:30" }));

    expect(screen.getByLabelText("Start time")).toHaveValue("11:30");
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

  it("preselects Stream for an event with a session behind it", () => {
    render(
      <EventEditor
        mode="edit"
        event={makeEvent({ track: "content", streamId: "stream-1" })}
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByRole("radio", { name: /stream/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: /content/i })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("links straight to the session behind a Stream block", () => {
    render(
      <EventEditor
        mode="edit"
        event={makeEvent({ track: "content", streamId: "stream-1" })}
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole("link", { name: /open stream session/i })
    ).toHaveAttribute("href", "/content/streams/stream-1");
  });

  it("offers no session link on an ordinary content event", () => {
    render(
      <EventEditor
        mode="edit"
        event={makeEvent({ track: "content" })}
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(
      screen.queryByRole("link", { name: /open stream session/i })
    ).not.toBeInTheDocument();
  });

  it("submits the picked kind, so switching to Stream reaches the action", async () => {
    updateEvent.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(
      <EventEditor
        mode="edit"
        event={makeEvent({ track: "content" })}
        open
        onOpenChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("radio", { name: /stream/i }));
    const field = document.querySelector<HTMLInputElement>(
      'input[name="track"]'
    );
    expect(field?.value).toBe("stream");
  });

  it("shows a dismissible conflict note when the event's sync link has one", async () => {
    dismissConflictNote.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <EventEditor
        mode="edit"
        event={makeEvent({
          conflictNote: "Overwritten by a Google Calendar edit",
        })}
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(
      screen.getByText("Overwritten by a Google Calendar edit")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(dismissConflictNote).toHaveBeenCalledWith("evt-1");
    expect(
      screen.queryByText("Overwritten by a Google Calendar edit")
    ).not.toBeInTheDocument();
  });

  it("shows no conflict note when the link is clean", () => {
    render(
      <EventEditor
        mode="edit"
        event={makeEvent()}
        open
        onOpenChange={vi.fn()}
      />
    );
    expect(
      screen.queryByRole("button", { name: "Dismiss" })
    ).not.toBeInTheDocument();
  });
});
