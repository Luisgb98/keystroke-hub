import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MonthStatsView } from "./month-stats";

const AUGUST = { publishedVideos: 3, streamsHeld: 2, ideasCreated: 9 };
const JULY = { publishedVideos: 1, streamsHeld: 2, ideasCreated: 4 };

describe("MonthStatsView", () => {
  it("shows the three headline numbers with their deltas against last month", () => {
    render(
      <MonthStatsView output={AUGUST} previous={JULY} previousMonth="2026-07" />
    );

    expect(screen.getByText("Videos published")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("+2 vs Jul")).toBeInTheDocument();

    expect(screen.getByText("Streams")).toBeInTheDocument();
    expect(screen.getByText("Same as Jul")).toBeInTheDocument();

    expect(screen.getByText("Ideas captured")).toBeInTheDocument();
    expect(screen.getByText("+5 vs Jul")).toBeInTheDocument();
  });

  it("reports a drop plainly rather than hiding it", () => {
    render(
      <MonthStatsView
        output={{ publishedVideos: 0, streamsHeld: 1, ideasCreated: 0 }}
        previous={JULY}
        previousMonth="2026-07"
      />
    );
    // Videos 1 → 0 and streams 2 → 1 both read as a plain "-1".
    expect(screen.getAllByText("-1 vs Jul")).toHaveLength(2);
    expect(screen.getByText("-4 vs Jul")).toBeInTheDocument();
  });

  it("renders an empty month as honest zeros against an equally empty previous month", () => {
    const empty = { publishedVideos: 0, streamsHeld: 0, ideasCreated: 0 };
    render(
      <MonthStatsView output={empty} previous={empty} previousMonth="2026-07" />
    );

    expect(screen.getAllByText("0")).toHaveLength(3);
    expect(screen.getAllByText("Same as Jul")).toHaveLength(3);
  });

  it("still shows this month's numbers when only the comparison failed", () => {
    render(
      <MonthStatsView output={AUGUST} previous={null} previousMonth="2026-07" />
    );

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText(/vs Jul/)).toBeNull();
  });

  it("degrades to a message when the query failed, rather than showing fake zeros", () => {
    render(
      <MonthStatsView output={null} previous={null} previousMonth="2026-07" />
    );

    expect(
      screen.getByText("Couldn’t load this month’s numbers.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("deep-links each tile into the feature behind it", () => {
    render(
      <MonthStatsView output={AUGUST} previous={JULY} previousMonth="2026-07" />
    );

    expect(
      screen.getByRole("link", { name: /Videos published/ })
    ).toHaveAttribute("href", "/content/ideas?status=published");
    expect(screen.getByRole("link", { name: /Streams/ })).toHaveAttribute(
      "href",
      "/content/streams"
    );
    expect(
      screen.getByRole("link", { name: /Ideas captured/ })
    ).toHaveAttribute("href", "/content/ideas");
  });
});
