import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StreamSummary } from "@/lib/data/streams";
import { StreamCard } from "./stream-card";

function makeStream(overrides: Partial<StreamSummary> = {}): StreamSummary {
  return {
    id: "stream-1",
    title: "Boss rush stream",
    retroNotes: null,
    game: null,
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
            // 19:00 in Madrid (CEST, +2) as an absolute instant — see #95.
            startsAt: new Date("2026-08-01T17:00:00.000Z"),
            endsAt: new Date("2026-08-01T19:00:00.000Z"),
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

  it("shows the game it's about, and nothing when untagged (#105)", () => {
    const { rerender } = render(
      <StreamCard
        stream={makeStream({ game: { id: "g-poe", name: "Path of Exile" } })}
      />
    );
    expect(screen.getByText("Path of Exile")).toBeInTheDocument();
    // Not a nested link: the whole card is already one.
    expect(screen.getAllByRole("link")).toHaveLength(1);

    rerender(<StreamCard stream={makeStream({ game: null })} />);
    expect(screen.queryByText("Path of Exile")).not.toBeInTheDocument();
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
