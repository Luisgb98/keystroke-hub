import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StandupView as StandupViewData } from "@/lib/journal/standup";
import { StandupView } from "./standup-view";

describe("StandupView", () => {
  it("shows yesterday's done items and today's plan", () => {
    const view: StandupViewData = {
      yesterday: {
        date: "2026-07-07",
        items: [{ id: "i-1", title: "Shipped the thing", status: "done" }],
        isEmpty: false,
      },
      today: {
        date: "2026-07-08",
        items: [{ id: "i-2", title: "Ship the next thing", status: "planned" }],
        isEmpty: false,
      },
    };
    render(<StandupView view={view} />);

    expect(screen.getByText("Shipped the thing")).toBeInTheDocument();
    expect(screen.getByText("Ship the next thing")).toBeInTheDocument();
    expect(
      screen.getByText("Tuesday, July 7, 2026 — done")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Wednesday, July 8, 2026 — plan")
    ).toBeInTheDocument();
  });

  it("shows a no-log message when there's no previous day at all", () => {
    const view: StandupViewData = {
      yesterday: null,
      today: { date: "2026-07-08", items: [], isEmpty: true },
    };
    render(<StandupView view={view} />);

    expect(screen.getByText("No previous log yet")).toBeInTheDocument();
  });

  it("nudges to add a plan when today is empty", () => {
    const view: StandupViewData = {
      yesterday: null,
      today: { date: "2026-07-08", items: [], isEmpty: true },
    };
    render(<StandupView view={view} />);

    expect(screen.getByText("No plan yet — add one.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to today's log" })
    ).toHaveAttribute("href", "/journal?date=2026-07-08");
  });

  it("strikes through done items within today's plan", () => {
    const view: StandupViewData = {
      yesterday: null,
      today: {
        date: "2026-07-08",
        items: [{ id: "i-1", title: "Already done", status: "done" }],
        isEmpty: false,
      },
    };
    render(<StandupView view={view} />);

    expect(screen.getByText("Already done")).toHaveClass("line-through");
  });
});
