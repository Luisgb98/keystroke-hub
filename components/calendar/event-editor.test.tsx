import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { QuickAddDefaults } from "@/lib/calendar/quick-add";
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

/**
 * Single-day content (#115). A stream or a release begins and ends on the same
 * day, so those kinds get one Date field — and there is no end-date input for
 * the owner to fix, or for a stale default to hide in.
 */
describe("EventEditor — single-day content kinds", () => {
  // What `quickAddFromSlot(day, 23)` actually hands the dialog: a real work
  // meeting, and an impossible stream. The live bug this issue names.
  const MIDNIGHT_SPANNING: QuickAddDefaults = {
    allDay: false,
    startDate: "2026-07-08",
    startTime: "23:00",
    endDate: "2026-07-09",
    endTime: "00:00",
  };

  function renderEditor(defaults: QuickAddDefaults = MIDNIGHT_SPANNING) {
    return render(
      <EventEditor
        mode="create"
        open
        onOpenChange={vi.fn()}
        defaults={defaults}
      />
    );
  }

  it.each(["content", "stream"] as const)(
    "renders one Date field and no end-date input for %s",
    async (kind) => {
      const user = userEvent.setup();
      renderEditor();

      await user.click(
        screen.getByRole("radio", { name: new RegExp(kind, "i") })
      );

      expect(screen.getByLabelText("Date")).toHaveValue("2026-07-08");
      expect(screen.queryByLabelText("Start")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("End")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Open ending day calendar" })
      ).not.toBeInTheDocument();
    }
  );

  it("keeps both time fields, labelled From and To", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("radio", { name: /stream/i }));

    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("To")).toBeInTheDocument();
    // The accessible names are unchanged, so every existing query still works.
    expect(screen.getByLabelText("Start time")).toHaveValue("23:00");
    // …and the end has been pulled back onto the day — see the repair test.
    expect(screen.getByLabelText("End time")).toHaveValue("23:59");
  });

  it("hides the time fields for an all-day content event", async () => {
    const user = userEvent.setup();
    renderEditor({
      allDay: true,
      startDate: "2026-07-08",
      endDate: "2026-07-08",
    });

    await user.click(screen.getByRole("radio", { name: /content/i }));

    expect(screen.getByLabelText("Date")).toHaveValue("2026-07-08");
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
  });

  it("moves the end date with the one date field", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("radio", { name: /content/i }));
    await user.click(
      screen.getByRole("button", { name: "Open the day calendar" })
    );
    await user.click(
      await screen.findByRole("button", { name: "Monday, July 20th, 2026" })
    );

    expect(screen.getByLabelText("Date")).toHaveValue("2026-07-20");
    // The value still posts — it just isn't something anyone can set apart
    // from the start.
    // The dialog renders in a portal, so this reads from the document rather
    // than the render container.
    expect(
      document.querySelector<HTMLInputElement>('input[name="endDate"]')?.value
    ).toBe("2026-07-20");
  });

  it("repairs a midnight-spanning default instead of opening on an invalid form", async () => {
    // Tapping the 23:00 slot and choosing Stream must not present an error the
    // owner has to clear — the end moves to the last minute of the day.
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("radio", { name: /stream/i }));

    expect(screen.getByLabelText("Date")).toHaveValue("2026-07-08");
    expect(screen.getByLabelText("Start time")).toHaveValue("23:00");
    expect(screen.getByLabelText("End time")).toHaveValue("23:59");
  });

  it("leaves a span that already fits the day untouched", async () => {
    const user = userEvent.setup();
    renderEditor({
      allDay: false,
      startDate: "2026-07-08",
      startTime: "09:00",
      endDate: "2026-07-08",
      endTime: "10:00",
    });

    await user.click(screen.getByRole("radio", { name: /content/i }));

    expect(screen.getByLabelText("Start time")).toHaveValue("09:00");
    expect(screen.getByLabelText("End time")).toHaveValue("10:00");
  });

  it("never carries a stale midnight-spanning end date back to Work", async () => {
    // Open on the 23:00 → next-day-00:00 default, touch the content track,
    // then flip back: the end date must have been pulled onto the start's day
    // rather than still pointing at tomorrow.
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("radio", { name: /stream/i }));
    await user.click(screen.getByRole("radio", { name: /work/i }));

    expect(screen.getByLabelText("Start")).toHaveValue("2026-07-08");
    expect(screen.getByLabelText("End")).toHaveValue("2026-07-08");
  });

  it("leaves the full range in place for a work event", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("radio", { name: /work/i }));

    expect(screen.getByLabelText("Start")).toBeInTheDocument();
    expect(screen.getByLabelText("End")).toBeInTheDocument();
    expect(screen.queryByLabelText("Date")).not.toBeInTheDocument();
  });

  it("shows one Date field when editing an existing stream", async () => {
    render(
      <EventEditor
        mode="edit"
        open
        onOpenChange={vi.fn()}
        event={makeEvent({ track: "content", streamId: "stream-1" })}
      />
    );

    expect(screen.getByLabelText("Date")).toHaveValue("2026-07-08");
    expect(screen.queryByLabelText("End")).not.toBeInTheDocument();
  });
});
