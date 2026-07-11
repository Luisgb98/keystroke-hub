import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { currentWeekParam, shiftWeekParam } from "@/lib/journal/week-dates";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { WeekHeader } from "./week-header";

describe("WeekHeader", () => {
  it("shows the formatted week label", () => {
    render(<WeekHeader weekStart="2026-07-06" />);
    expect(screen.getByText("Jul 6–12, 2026")).toBeInTheDocument();
  });

  it("Previous week navigates back one week", async () => {
    const user = userEvent.setup();
    render(<WeekHeader weekStart="2026-07-06" />);

    await user.click(screen.getByRole("button", { name: "Previous week" }));

    expect(push).toHaveBeenCalledWith("/journal/week?week=2026-06-29");
  });

  it("Next week navigates forward one week", async () => {
    const user = userEvent.setup();
    render(<WeekHeader weekStart="2026-07-06" />);

    await user.click(screen.getByRole("button", { name: "Next week" }));

    expect(push).toHaveBeenCalledWith("/journal/week?week=2026-07-13");
  });

  it("shows a This week shortcut when viewing a different week", async () => {
    const user = userEvent.setup();
    const otherWeek = shiftWeekParam(currentWeekParam(), -1);
    render(<WeekHeader weekStart={otherWeek} />);

    await user.click(screen.getByRole("button", { name: "This week" }));
    expect(push).toHaveBeenCalledWith(
      `/journal/week?week=${currentWeekParam()}`
    );
  });

  it("hides the This week shortcut when already viewing the current week", () => {
    render(<WeekHeader weekStart={currentWeekParam()} />);
    expect(
      screen.queryByRole("button", { name: "This week" })
    ).not.toBeInTheDocument();
  });
});
