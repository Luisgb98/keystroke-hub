import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AgendaItem } from "@/lib/calendar/agenda";
import type { CalendarEvent } from "@/lib/calendar/types";

import { AgendaItemRow } from "./agenda-item";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "1",
    track: "work",
    title: "Sprint planning",
    description: null,
    startsAt: new Date("2026-07-08T14:00:00"),
    endsAt: new Date("2026-07-08T15:00:00"),
    allDay: false,
    conflictNote: null,
    linkedIdeas: [],
    ...overrides,
  };
}

function makeItem(overrides: Partial<AgendaItem> = {}): AgendaItem {
  return {
    event: makeEvent(),
    timeLabel: "14:00",
    inProgress: false,
    ...overrides,
  };
}

describe("AgendaItemRow", () => {
  it("renders the work track with its icon, label, surface classes, and time", () => {
    render(<AgendaItemRow item={makeItem()} />);

    expect(screen.getByText("Sprint planning")).toBeInTheDocument();
    expect(screen.getByText("Work:")).toBeInTheDocument();
    expect(screen.getByText("14:00")).toBeInTheDocument();
    const row = screen.getByText("Sprint planning").closest("button");
    expect(row).toHaveClass("bg-track-work");
    expect(row).toHaveClass("border-track-work-border");
    expect(row?.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the content track with its icon, label, and surface classes", () => {
    render(
      <AgendaItemRow
        item={makeItem({
          event: makeEvent({ track: "content", title: "Record voiceover" }),
        })}
      />
    );

    expect(screen.getByText("Record voiceover")).toBeInTheDocument();
    expect(screen.getByText("Content:")).toBeInTheDocument();
    const row = screen.getByText("Record voiceover").closest("button");
    expect(row).toHaveClass("bg-track-content");
    expect(row).toHaveClass("border-track-content-border");
  });

  it("shows 'All day' for an all-day event", () => {
    render(
      <AgendaItemRow
        item={makeItem({
          timeLabel: "All day",
          event: makeEvent({ allDay: true }),
        })}
      />
    );

    expect(screen.getByText("All day")).toBeInTheDocument();
  });

  it("shows 'Now' and emphasizes it for an in-progress event", () => {
    render(
      <AgendaItemRow item={makeItem({ timeLabel: "Now", inProgress: true })} />
    );

    expect(screen.getByText("Now")).toHaveClass("font-semibold");
  });

  it("shows a conflict indicator when the event has a conflict note", () => {
    render(
      <AgendaItemRow
        item={makeItem({ event: makeEvent({ conflictNote: "Resolved" }) })}
      />
    );

    expect(
      screen.getByRole("img", {
        name: "Sync conflict was resolved on this event",
      })
    ).toBeInTheDocument();
  });

  it("opens the edit dialog on click", () => {
    render(<AgendaItemRow item={makeItem()} />);

    fireEvent.click(screen.getByText("Sprint planning").closest("button")!);

    expect(screen.getByText("Edit event")).toBeInTheDocument();
  });
});
