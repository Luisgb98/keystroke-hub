import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StreamSummary } from "@/lib/data/streams";
import { StreamCard } from "./stream-card";

function makeStream(overrides: Partial<StreamSummary> = {}): StreamSummary {
  return {
    id: "stream-1",
    title: "Boss rush stream",
    retroNotes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    event: null,
    checklistDone: 0,
    checklistTotal: 0,
    ...overrides,
  };
}

describe("StreamCard", () => {
  it("links to the stream's detail page", () => {
    render(<StreamCard stream={makeStream({ id: "stream-9" })} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/content/streams/stream-9"
    );
  });

  it("shows 'Unscheduled' when there's no linked event", () => {
    render(<StreamCard stream={makeStream({ event: null })} />);
    expect(screen.getByText("Unscheduled")).toBeInTheDocument();
  });

  it("shows the event's date/time when scheduled", () => {
    render(
      <StreamCard
        stream={makeStream({
          event: {
            id: "evt-1",
            title: "E",
            startsAt: new Date("2026-08-01T19:00:00"),
            endsAt: new Date("2026-08-01T21:00:00"),
            allDay: false,
          },
        })}
      />
    );
    expect(screen.getByText("Aug 1, 19:00")).toBeInTheDocument();
  });

  it("shows checklist progress only when there are checklist items", () => {
    const { rerender } = render(
      <StreamCard
        stream={makeStream({ checklistDone: 2, checklistTotal: 5 })}
      />
    );
    expect(screen.getByText("2/5")).toBeInTheDocument();

    rerender(
      <StreamCard
        stream={makeStream({ checklistDone: 0, checklistTotal: 0 })}
      />
    );
    expect(screen.queryByText("0/0")).not.toBeInTheDocument();
  });

  it("shows a notes indicator only when retro notes exist", () => {
    const { rerender } = render(
      <StreamCard stream={makeStream({ retroNotes: "Went well" })} />
    );
    expect(screen.getByText("Notes")).toBeInTheDocument();

    rerender(<StreamCard stream={makeStream({ retroNotes: null })} />);
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
  });
});
