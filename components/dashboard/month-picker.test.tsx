import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  currentMonthParam,
  shiftMonthParam,
} from "@/lib/dashboard/month-review";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { MonthPicker } from "./month-picker";

const LAST_MONTH = shiftMonthParam(currentMonthParam(), -1);

describe("MonthPicker", () => {
  it("shows the month it is reviewing", () => {
    render(<MonthPicker month="2026-07" />);
    expect(screen.getByText("July 2026")).toBeInTheDocument();
  });

  it("steps back a month by putting it in the URL, so the choice survives a reload", async () => {
    const user = userEvent.setup();
    render(<MonthPicker month="2026-07" />);

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(push).toHaveBeenCalledWith("/?month=2026-06");
  });

  it("steps forward again from a past month", async () => {
    const user = userEvent.setup();
    render(<MonthPicker month="2026-07" />);

    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(push).toHaveBeenCalledWith("/?month=2026-08");
  });

  it("never steps forward past the current month", () => {
    render(<MonthPicker month={currentMonthParam()} />);
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
  });

  it("offers a way back to this month only while looking at another one", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<MonthPicker month={currentMonthParam()} />);
    expect(screen.queryByRole("button", { name: "This month" })).toBeNull();
    unmount();

    render(<MonthPicker month={LAST_MONTH} />);
    await user.click(screen.getByRole("button", { name: "This month" }));
    expect(push).toHaveBeenCalledWith(`/?month=${currentMonthParam()}`);
  });

  it("crosses the year boundary in both directions", async () => {
    const user = userEvent.setup();
    render(<MonthPicker month="2026-01" />);

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(push).toHaveBeenCalledWith("/?month=2025-12");
  });
});
