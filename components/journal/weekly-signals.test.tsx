import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WeeklySignals } from "./weekly-signals";

describe("WeeklySignals", () => {
  it("renders a friendly line for a week with nothing logged", () => {
    render(
      <WeeklySignals
        signals={{
          weekdaysLogged: 0,
          weekdayCount: 5,
          doneCount: 0,
          trackedCount: 0,
          carriedOverCount: 0,
        }}
      />
    );

    expect(
      screen.getByText("Nothing logged yet this week.")
    ).toBeInTheDocument();
  });

  it("renders each observation as its own muted line, phrased as observation not verdict", () => {
    render(
      <WeeklySignals
        signals={{
          weekdaysLogged: 3,
          weekdayCount: 5,
          doneCount: 8,
          trackedCount: 11,
          carriedOverCount: 2,
        }}
      />
    );

    expect(screen.getByText("You logged 3 of 5 weekdays.")).toBeInTheDocument();
    expect(
      screen.getByText("8 of 11 items logged this week got done.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("2 items still carrying over.")
    ).toBeInTheDocument();
  });
});
