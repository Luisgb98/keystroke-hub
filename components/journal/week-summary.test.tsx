import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WeekSummary } from "@/lib/journal/week-summary";
import { WeekSummaryView } from "./week-summary";

const DAYS = [
  "2026-07-06",
  "2026-07-07",
  "2026-07-08",
  "2026-07-09",
  "2026-07-10",
  "2026-07-11",
  "2026-07-12",
];

function emptySummary(overrides: Partial<WeekSummary> = {}): WeekSummary {
  return {
    weekStart: "2026-07-06",
    doneByDay: DAYS.map((date) => ({ date, done: [] })),
    retros: [],
    carriedOver: [],
    highlights: "",
    isEmpty: true,
    rating: null,
    wentWell: "",
    drainedMe: "",
    changeNext: "",
    signals: {
      weekdaysLogged: 0,
      weekdayCount: 5,
      doneCount: 0,
      trackedCount: 0,
      carriedOverCount: 0,
    },
    ...overrides,
  };
}

describe("WeekSummaryView", () => {
  it("shows a friendly empty state and a link back to today's log for an empty week", () => {
    render(<WeekSummaryView summary={emptySummary()} />);

    expect(
      screen.getByText(/Nothing logged this week yet\./)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to today's log" })
    ).toHaveAttribute("href", "/journal");
  });

  it("groups done items by weekday and always shows Mon-Fri, even when empty", () => {
    const doneByDay: WeekSummary["doneByDay"] = DAYS.map((date) => ({
      date,
      done: [],
    }));
    doneByDay[0] = {
      date: DAYS[0],
      done: [{ id: "i-1", title: "Shipped the thing" }],
    };

    render(
      <WeekSummaryView summary={emptySummary({ doneByDay, isEmpty: false })} />
    );

    expect(screen.getByText("Shipped the thing")).toBeInTheDocument();
    // Tuesday (index 1) has no done items but is a weekday, so it still renders.
    expect(screen.getAllByText("Nothing logged.")).toHaveLength(4); // Tue-Fri
    expect(screen.queryByText("Sunday, July 12, 2026")).not.toBeInTheDocument();
  });

  it("shows a weekend day when it has done items", () => {
    const doneByDay: WeekSummary["doneByDay"] = DAYS.map((date) => ({
      date,
      done: [],
    }));
    doneByDay[5] = {
      date: DAYS[5],
      done: [{ id: "i-1", title: "Weekend work" }],
    };

    render(
      <WeekSummaryView summary={emptySummary({ doneByDay, isEmpty: false })} />
    );

    expect(screen.getByText("Saturday, July 11, 2026")).toBeInTheDocument();
    expect(screen.getByText("Weekend work")).toBeInTheDocument();
  });

  it("renders retros with their mood label", () => {
    render(
      <WeekSummaryView
        summary={emptySummary({
          retros: [{ date: DAYS[0], retro: "Solid start", mood: 4 }],
          isEmpty: false,
        })}
      />
    );

    expect(screen.getByText("Solid start")).toBeInTheDocument();
    expect(screen.getByText("Good")).toBeInTheDocument();
  });

  it("renders carried-over items with the day they first appeared", () => {
    render(
      <WeekSummaryView
        summary={emptySummary({
          carriedOver: [
            { id: "i-1", title: "Stuck task", firstAppearedDate: DAYS[0] },
          ],
          isEmpty: false,
        })}
      />
    );

    expect(screen.getByText("Stuck task")).toBeInTheDocument();
    expect(screen.getByText("since Jul 6")).toBeInTheDocument();
  });

  it("each day links back to that day's journal entry", () => {
    render(<WeekSummaryView summary={emptySummary({ isEmpty: false })} />);

    expect(
      screen.getByRole("link", { name: "Monday, July 6, 2026" })
    ).toHaveAttribute("href", "/journal?date=2026-07-06");
  });
});
