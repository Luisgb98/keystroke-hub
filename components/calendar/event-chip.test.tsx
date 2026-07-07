import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "@/lib/calendar/types";

import { EventChip } from "./event-chip";

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

describe("EventChip", () => {
  it("renders the work track with its icon, label, and surface classes", () => {
    render(<EventChip event={makeEvent({ track: "work" })} />);

    expect(screen.getByText("Sprint planning")).toBeInTheDocument();
    expect(screen.getByText("Work:")).toBeInTheDocument();
    const chip = screen.getByText("Sprint planning").closest("div");
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
    const chip = screen.getByText("Record voiceover").closest("div");
    expect(chip).toHaveClass("bg-track-content");
    expect(chip).toHaveClass("border-track-content-border");
  });

  it("truncates long titles without breaking layout", () => {
    render(<EventChip event={makeEvent({ title: "A".repeat(200) })} />);
    expect(screen.getByText("A".repeat(200))).toHaveClass("truncate");
  });
});
