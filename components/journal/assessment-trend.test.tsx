import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TrendWeek } from "@/lib/journal/trend";

import { AssessmentTrend } from "./assessment-trend";

function gapWeeks(count: number, startingFrom: string): TrendWeek[] {
  const weeks: TrendWeek[] = [];
  const start = new Date(`${startingFrom}T00:00:00`);
  for (let i = 0; i < count; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i * 7);
    weeks.push({
      weekStart: date.toISOString().slice(0, 10),
      rating: null,
      changeNext: null,
    });
  }
  return weeks;
}

describe("AssessmentTrend", () => {
  it("shows an empty state when no week in the range has any data", () => {
    render(<AssessmentTrend weeks={gapWeeks(3, "2026-06-15")} />);
    expect(screen.getByText("No weeks assessed yet.")).toBeInTheDocument();
  });

  it("renders an assessed week's rating and change-next note, linked to its week view", () => {
    const weeks: TrendWeek[] = [
      { weekStart: "2026-06-29", rating: 4, changeNext: "Ship smaller PRs" },
    ];
    render(<AssessmentTrend weeks={weeks} />);

    expect(screen.getByText("Ship smaller PRs")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Ship smaller PRs/ })
    ).toHaveAttribute("href", "/journal/week?week=2026-06-29");
    expect(screen.getByLabelText("Rating 4 of 5")).toBeInTheDocument();
  });

  it("renders an unassessed neighbor as a quiet gap, not a failure", () => {
    const weeks: TrendWeek[] = [
      { weekStart: "2026-06-29", rating: 4, changeNext: null },
      { weekStart: "2026-07-06", rating: null, changeNext: null },
    ];
    render(<AssessmentTrend weeks={weeks} />);

    expect(screen.getAllByText("Not assessed")).toHaveLength(1);
    expect(screen.getByLabelText("Not assessed")).toBeInTheDocument();
  });
});
